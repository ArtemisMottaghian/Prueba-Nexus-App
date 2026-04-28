import asyncio
from dotenv import load_dotenv
from sqlalchemy import select
load_dotenv()
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy.dialects.postgresql import insert
from app.db.session import AsyncSessionLocal
from app.services.enrichment_service import enrich_company

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
            result = await asyncio.wait_for(scraper_func(), timeout=900)  # 5 min máximo

            if isinstance(result, list):
                raw_offers.extend(result)
                print(f"{name.upper()} terminado. {len(result)} ofertas extraídas.")

        except asyncio.TimeoutError:
            print(f"TIMEOUT en {name.upper()} — saltando scraper")
            await log_scraper_error(
                error_code=f"SCRAPER_{name.upper()}_TIMEOUT",
                message=f"scraper={name} | stage=gather | exc=TimeoutError after 300s",
            )

        except Exception as e:
            print(f"Error crítico en {name.upper()}: {e}")
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


async def save_to_database(enriched_data_list):
    """
    Guarda las ofertas y empresas en la base de datos de forma segura,
    enlazándolas mediante company_id y actualizando si ya existen.
    """
    async with AsyncSessionLocal() as session:
        for item in enriched_data_list:
            # Extraemos los datos de la oferta
            offer_data = item.get("offer_data", item) # Por si la estructura varía un poco
            company_name = offer_data.get("company_name")

            # Lo definimos vacío por si la oferta viene sin nombre de empresa
            company_id = None 

            try:
                if company_name:
                    # Buscamos si la empresa ya existe en la BD
                    stmt_check_company = select(Company.id).where(Company.name == company_name)
                    result_company = await session.execute(stmt_check_company)
                    company_id = result_company.scalar_one_or_none()

                    # Si no existe, la creamos y nos guardamos su ID nuevo
                    if not company_id:
                        job_desc = offer_data.get("job_description", "")
                        enriched_company_data = await enrich_company(company_name, job_desc)
                        stmt_new_company = (
                            insert(Company)
                            .values(
                                name=company_name,
                            original_offer_id=offer_data.get("external_id"),
                            cif=enriched_company_data.get("cif"),
                            website=enriched_company_data.get("website"),
                            sector=enriched_company_data.get("sector"),
                            address=enriched_company_data.get("address"),
                            linkedin_url=enriched_company_data.get("linkedin_url")
                            )
                            .returning(Company.id)
                        )
                        result_new_company = await session.execute(stmt_new_company)
                        company_id = result_new_company.scalar_one()

                # 1. Le ponemos el número ID de la empresa que acabamos de crear/buscar
                offer_data["company_id"] = company_id
                
                # 2. Borramos el texto con el nombre para que la BD no se queje de columnas que no existen
                offer_data.pop("company_name", None)
                recruiter_name = offer_data.pop("recruiter_name", None)
                recruiter_email = offer_data.pop("recruiter_email", None)
                
                if not recruiter_name and company_name:
                    print(f"   -> Buscando reclutador para {company_name} en LinkedIn...")
                    pb_data = await search_with_phantombuster(company_name)
                    if pb_data:
                        recruiter_name = f"{pb_data['nombre']} {pb_data['apellidos']}"
                        
                if (recruiter_name or recruiter_email) and company_id:
                    try:
                        stmt_contact = insert(Contact).values(
                            company_id=company_id,
                            full_name = recruiter_name,
                            email=recruiter_email
                        ).on_conflict_do_nothing()
                        
                        await session.execute(stmt_contact)
                    except Exception as e:
                        print(f"Error no se pudo guardar el contacto {recruiter_name}: {e}")

                # Imprimimos en consola para saber qué está haciendo
                external_id = offer_data.get('external_id', 'SIN-ID')
                title = offer_data.get('title', 'Sin título')
                print(f"[DB] Procesando oferta: {external_id} - {title[:40]}...")

                stmt_offer = insert(JobOffer).values(**offer_data)
                
                # Si la oferta ya existe (mismo portal y mismo ID), la actualizamos
                stmt_offer = stmt_offer.on_conflict_do_update(
                    index_elements=['portal_id', 'external_id'],
                    set_={
                        "company_id": stmt_offer.excluded.company_id,
                        "title": stmt_offer.excluded.title,
                        "location": stmt_offer.excluded.location,
                        "offer_url": stmt_offer.excluded.offer_url,
                        "job_description": stmt_offer.excluded.job_description,
                        "salary_min": stmt_offer.excluded.salary_min,
                        "salary_max": stmt_offer.excluded.salary_max,
                        "contract_type": stmt_offer.excluded.contract_type,
                        "contract_time": stmt_offer.excluded.contract_time,
                        "work_modality": stmt_offer.excluded.work_modality,
                        "sector": stmt_offer.excluded.sector
                    }
                )
                
                await session.execute(stmt_offer)
                await session.commit()

            except Exception as e:
                await session.rollback()
                # Esto imprimirá en rojo en tu consola si hay cualquier fallo oculto
                print(f"\n[CRITICAL BBDD] Error al guardar la oferta {offer_data.get('external_id')}: {e}\n")
                
                # Guarda el error en la tabla error_logs que creamos antes
                try:
                    from app.services.scraper_logs_service import log_scraper_error
                    await log_scraper_error(
                        error_code="SCRAPPER_ORCHESTRATOR_DB",
                        message=f"stage=db_save | exc={e}",
                    )
                except Exception as log_e:
                    pass # Si el log falla, no queremos que rompa el programa principal


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
