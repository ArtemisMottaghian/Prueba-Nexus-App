import asyncio
from dotenv import load_dotenv
from sqlalchemy import select
load_dotenv()
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy.dialects.postgresql import insert
from app.db.session import AsyncSessionLocal


from app.models.user_model import User
from app.models.job_model import JobOffer
from app.models.contacts_model import Contact
from app.models.companies_model import Company 

from app.schemas.job_offer import ScrapedJobOffer
from app.services.scrapers.scraper_vacancies_linkedin.runner import extract_linked
from app.services.scrapers.scraper_vacancies_adzuna import extract_adzuna
from app.services.scrapers.scraper_vacancies_infojobs.runner import extract_infojobs
from app.services.enrichment_service import (
    search_in_dropcontact,
    search_with_phantombuster,
)
from app.services.scraper_logs_service import log_scraper_error
from app.services.vacancies_service import update_portal_last_run

SKIP_ENRICHMENT = False



async def gather_raw_offers() -> list[dict]:
    """
    Ejecuta todos los scrapers de forma concurrente, gestiona los errores individuales
    y unifica todos los resultados en una sola lista plana.

    Returns:
        list[dict]: Lista de diccionarios crudos con las ofertas extraídas de todos los portales.
    """

    raw_offers = []

    # Lista de scrapers a ejecutar (Comenta los que no quieras usar)
    scrapers = [
        ("adzuna", extract_adzuna),
        ("linkedin", extract_linked),
        ("infojobs", extract_infojobs),
    ]

    for name, scraper_func in scrapers:
        print(f"\nIniciando scraper: {name.upper()}...")
        try:
            result = await asyncio.wait_for(scraper_func(), timeout=300)  # 5 min máximo

            if isinstance(result, list):
                raw_offers.extend(result)
                print(f"{name.upper()} terminado. {len(result)} ofertas extraídas.")
                await update_portal_last_run(name, status="ok")

        except asyncio.TimeoutError:
            print(f"TIMEOUT en {name.upper()} — saltando scraper")
            await update_portal_last_run(name, status="timeout")
            await log_scraper_error(
                error_code=f"SCRAPER_{name.upper()}_TIMEOUT",
                message=f"scraper={name} | stage=gather | exc=TimeoutError after 300s",
            )

        except Exception as e:
            print(f"Error crítico en {name.upper()}: {e}")
            await update_portal_last_run(name, status="error")
            await log_scraper_error(
                error_code=f"SCRAPER_{name.upper()}_CRITICAL",
                message=f"scraper={name} | stage=gather | exc={e}",
            )

    return raw_offers


def validate_and_filter_offers(raw_offers: list[dict]) -> list[ScrapedJobOffer]:
    """
    Valida las ofertas crudas contra el esquema de Pydantic y descarta aquellas
    que no tengan nombre de empresa o que tengan más de 72 horas de antigüedad.

    Args:
        raw_offers (list[dict]): Lista de ofertas crudas extraídas por los scrapers.

    Returns:
        list[ScrapedJobOffer]: Lista de ofertas validadas como objetos Pydantic.
    """

    valid_offers = []
    today = datetime.now(timezone.utc)

    for offer in raw_offers:
        try:
            validated_offer = ScrapedJobOffer(**offer)

            if not validated_offer.company_name:
                continue

            public_date = validated_offer.published_at
            if public_date:
                if public_date.tzinfo is None:
                    public_date = public_date.replace(tzinfo=timezone.utc)

                time_filter = today - public_date
                if time_filter > timedelta(hours=72):
                    continue

            valid_offers.append(validated_offer)
        except Exception:
            continue

    return valid_offers


async def enrich_single_offer(offer: ScrapedJobOffer) -> dict[str, Any]:
    """
    Intenta enriquecer una oferta buscando el email y nombre del reclutador
    usando Dropcontact y PhantomBuster si es necesario.

    Args:
        offer (ScrapedJobOffer): Objeto Pydantic con la oferta validada.

    Returns:
        dict[str, Any]: Diccionario con los datos de la oferta original más
                        el reclutador y email obtenidos (si los hay).
    """

    offer_dict = offer.model_dump()
    obtained_email = offer_dict.get("recruiter_email")
    company = offer_dict.get("company_name")
    recruiter = offer_dict.get("recruiter_name")

    if offer_dict.get("offer_url"):
        offer_dict["offer_url"] = str(offer_dict["offer_url"])

    if SKIP_ENRICHMENT:
        return {
            "offer_data": offer_dict,
            "recruiter_name": recruiter,
            "recruiter_email": obtained_email,
        }

    if not obtained_email:
        # Tenemos el nombre, pero no el correo -> A Dropcontact directo
        if recruiter and company:
            obtained_email = await search_in_dropcontact(
                name=recruiter, company=company
            )

        # No tenemos ni el nombre ni el correo -> A PhantomBuster primero
        elif company and not recruiter:
            phantom_data = await search_with_phantombuster(company)

            if phantom_data and phantom_data.get("nombre"):
                recruiter = f"{phantom_data['nombre']} {phantom_data.get('apellidos', '')}".strip()
                obtained_email = await search_in_dropcontact(
                    name=recruiter, company=company
                )

    if offer_dict.get("offer_url"):
        offer_dict["offer_url"] = str(offer_dict["offer_url"])

    return {
        "offer_data": offer_dict,
        "recruiter_name": recruiter,
        "recruiter_email": obtained_email,
    }


async def save_to_database(enriched_data_list: list[dict | Exception]) -> None:
    """
    Guarda las ofertas enriquecidas en la base de datos de forma transaccional.
    Si la oferta es nueva, crea automáticamente los registros de Empresa y Contacto. Comprobando si ya existen para evitar duplicados

    Args:
        enriched_data_list (list[dict | Exception]): Resultados del enriquecimiento.
            Puede contener Excepciones si algún proceso falló.

    Returns:
        None
    """

    async with AsyncSessionLocal() as session:
        try:
            for item in enriched_data_list:
                if isinstance(item, Exception):
                    await log_scraper_error(
                        error_code="ENRICHMENT_ERROR",
                        message=f"stage=enrichment | exc={item}",
                    )
                    continue

                offer_data = item["offer_data"]
                recruiter_name = item["recruiter_name"]
                recruiter_email = item["recruiter_email"]

                offer_data.pop("recruiter_name", None)
                offer_data.pop("recruiter_email", None)
                offer_data.pop("fingerprint", None)

                offer_data.pop("company_id", None)

                stmt_offer = insert(JobOffer).values(**offer_data)
                stmt_offer = stmt_offer.on_conflict_do_nothing(
                    constraint="unique_offer_per_portal"
                ).returning(JobOffer.id)

                result_offer = await session.execute(stmt_offer)
                new_offer_id = result_offer.scalar_one_or_none()

                if new_offer_id:
                    company_name = offer_data.get("company_name")
                    
                    company_id = None

                    # comprobamos si la empresa no existe
                    if company_name:
                        result_company = await session.execute(
                            select(Company.id).where(Company.name == company_name)
                        )
                        company_id = result_company.scalar_one_or_none()

                        # si no existe la creamos y obtenemos id
                        if not company_id:
                            stmt_new_company = (
                                insert(Company)
                                .values(name=company_name)
                                .returning(Company.id)
                            )
                            result_new_company = await session.execute(stmt_new_company)
                            company_id = result_new_company.scalar_one()

                    
                    # Insertamos Contacto si existe
                    if recruiter_name or recruiter_email:
                        stmt_contact = insert(Contact).values(
                            company_id=company_id,
                            full_name=recruiter_name or "HR Department",
                            email=recruiter_email,
                            job_title="HR / Recruiter",
                        )
                        stmt_contact = stmt_contact.on_conflict_do_nothing()
                        await session.execute(stmt_contact)

            await session.commit()

        except Exception as e:
            await session.rollback()
            await log_scraper_error(
                error_code="SCRAPPER_ORCHESTRATOR_DB",
                message=f"stage=db_save | exc={e}",
            )


async def run_scrapers() -> None:
    """
    Orquestador principal. Coordina la extracción, validación, enriquecimiento
    y guardado de las ofertas de empleo en la base de datos.

    Returns:
        None
    """

    raw_offers = await gather_raw_offers()
    if not raw_offers:
        return

    valid_offers = validate_and_filter_offers(raw_offers)
    if not valid_offers:
        return

    enrichment_tasks = [enrich_single_offer(offer) for offer in valid_offers]
    enriched_data_list = await asyncio.gather(*enrichment_tasks, return_exceptions=True)

    if SKIP_ENRICHMENT:
        print(
            f"\n[MODO PRUEBAS] Ofertas listas para guardar (Enriquecimiento saltado): {len(enriched_data_list)}"
        )
        for i, item in enumerate(
            enriched_data_list[:3]
        ):
            print(
                f"  Oferta {i+1}: {item.get('offer_data', {}).get('title')} | Reclutador: {item.get('recruiter_name')}"
            )

    await save_to_database(enriched_data_list)


if __name__ == "__main__":
    asyncio.run(run_scrapers())
