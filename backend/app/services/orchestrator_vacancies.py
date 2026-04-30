import asyncio
from dotenv import load_dotenv
from sqlalchemy import select, update, func
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
        #("linkedin", extract_linked),
        #("infojobs", extract_infojobs),
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


async def process_and_save_offers(valid_offers: list[ScrapedJobOffer]):
    """
    Toma la lista de ofertas válidas, evalúa una por una si es nueva o repetida.
    Actualiza las repetidas silenciosamente (omitiendo NULLs) y enriquece/guarda las nuevas.
    """
    nuevas_guardadas = 0
    actualizadas = 0

    async with AsyncSessionLocal() as session:
        for offer in valid_offers:
            
            offer_dict = offer.model_dump()
            
            # --- [PARCHE 2] Convertimos el objeto HttpUrl de Pydantic a String normal ---
            if offer_dict.get("offer_url"):
                offer_dict["offer_url"] = str(offer_dict["offer_url"])
                
            p_id = offer_dict.get("portal_id")
            ext_id = str(offer_dict.get("external_id"))

            # 1. ¿Existe ya la oferta en la base de datos?
            stmt_check_job = select(JobOffer.id).where(
                JobOffer.portal_id == p_id,
                JobOffer.external_id == ext_id
            )
            result_job = await session.execute(stmt_check_job)
            job_exists = result_job.scalar_one_or_none()

            if job_exists:
                # --- ES REPETIDA: Actualizamos sin gastar recursos de IA usando COALESCE ---
                stmt_update = (
                    update(JobOffer)
                    .where(JobOffer.id == job_exists)
                    .values(
                        title=func.coalesce(offer_dict.get('title'), JobOffer.title),
                        location=func.coalesce(offer_dict.get('location'), JobOffer.location),
                        offer_url=func.coalesce(offer_dict.get('offer_url'), JobOffer.offer_url),
                        job_description=func.coalesce(offer_dict.get('job_description'), JobOffer.job_description),
                        salary_min=func.coalesce(offer_dict.get('salary_min'), JobOffer.salary_min),
                        salary_max=func.coalesce(offer_dict.get('salary_max'), JobOffer.salary_max),
                        contract_type=func.coalesce(offer_dict.get('contract_type'), JobOffer.contract_type),
                        contract_time=func.coalesce(offer_dict.get('contract_time'), JobOffer.contract_time),
                        work_modality=func.coalesce(offer_dict.get('work_modality'), JobOffer.work_modality),
                        sector=func.coalesce(offer_dict.get('sector'), JobOffer.sector)
                    )
                )
                await session.execute(stmt_update)
                await session.commit()
                actualizadas += 1
                print(f"-> [REPETIDA] Oferta {ext_id} actualizada silenciosamente (protegiendo datos con COALESCE).")

            else:
                # --- ES NUEVA: Enriquecemos con la IA y guardamos ---
                print(f"\n[NUEVA] Detectada oferta nueva: {ext_id}. Iniciando Inteligencia Artificial...")
                
                enriched_item = await enrich_single_offer(offer)
                offer_data = enriched_item.get("offer_data", {})
                company_name = offer_data.get("company_name")
                company_id = None
                
                # --- [PARCHE 1] Limpiamos las columnas rebeldes antes de tocar la BBDD ---
                offer_data.pop("recruiter_name", None)
                offer_data.pop("recruiter_email", None)
                offer_data.pop("recruiter_phone", None)
                # Volvemos a asegurar que la URL sea un string en caso de que enrich_single_offer traiga el HttpUrl
                if offer_data.get("offer_url"):
                    offer_data["offer_url"] = str(offer_data["offer_url"])

                try:
                    if company_name:
                        # Buscamos la empresa
                        stmt_check_company = select(Company.id).where(Company.name == company_name)
                        result_company = await session.execute(stmt_check_company)
                        company_id = result_company.scalar_one_or_none()

                        # Si la empresa no existe, la creamos y la enriquecemos
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
                                    linkedin_url=enriched_company_data.get("linkedin_url"),
                                    company_description=enriched_company_data.get("company_description") 
                                )
                                .returning(Company.id)
                            )
                            result_new_company = await session.execute(stmt_new_company)
                            company_id = result_new_company.scalar_one()

                    # Limpiamos y asignamos identificadores para JobOffer
                    offer_data["company_id"] = company_id
                    offer_data.pop("company_name", None)
                    recruiter_name = enriched_item.get("recruiter_name")
                    recruiter_email = enriched_item.get("recruiter_email")

                    # Búsqueda de reclutador de respaldo con PhantomBuster
                    if not recruiter_name and company_name:
                        print(f"   -> Buscando reclutador para {company_name} en LinkedIn...")
                        pb_data = await search_with_phantombuster(company_name)
                        if pb_data:
                            recruiter_name = f"{pb_data['nombre']} {pb_data.get('apellidos', '')}".strip()

                    # Guardar Contacto
                    if (recruiter_name or recruiter_email) and company_id:
                        try:
                            stmt_contact = insert(Contact).values(
                                company_id=company_id,
                                full_name=recruiter_name,
                                email=recruiter_email
                            ).on_conflict_do_nothing()
                            await session.execute(stmt_contact)
                        except Exception as e:
                            print(f"Error al guardar el contacto {recruiter_name}: {e}")

                    # Guardar Oferta Nueva
                    stmt_offer = insert(JobOffer).values(**offer_data).on_conflict_do_nothing()
                    await session.execute(stmt_offer)
                    await session.commit()

                    nuevas_guardadas += 1
                    print(f" -> [ÉXITO] Oferta nueva guardada en la base de datos.")

                except Exception as e:
                    await session.rollback()
                    print(f"\n[CRITICAL BBDD] Error al guardar oferta nueva: {e}\n")
                    await log_scraper_error(error_code="SCRAPPER_ORCHESTRATOR_DB", message=f"stage=db_save | exc={e}")

    print(f"Ofertas extraídas por los scrapers: {len(valid_offers)}")
    print(f"Ofertas REPETIDAS (actualizadas sin pisar datos): {actualizadas}")
    print(f"Ofertas NUEVAS (enriquecidas e insertadas): {nuevas_guardadas}")



async def run_scrapers() -> None:
    """
    Orquestador principal. Coordina la extracción, validación, enriquecimiento
    y guardado de las ofertas de empleo en la base de datos.
    """
    raw_offers = await gather_raw_offers()
    if not raw_offers:
        return

    valid_offers = validate_and_filter_offers(raw_offers)
    if not valid_offers:
        return

    await process_and_save_offers(valid_offers)


if __name__ == "__main__":
    asyncio.run(run_scrapers())