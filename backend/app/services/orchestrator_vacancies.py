import os
import re
import asyncio
import aiohttp
from dotenv import load_dotenv
from sqlalchemy import select, update, func

load_dotenv()
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy.dialects.postgresql import insert
from app.db.session import AsyncSessionLocal
from app.services.enrichment_service import enrich_company, search_and_extract_recruiter

from app.models.user_model import User
from app.models.job_model import JobOffer
from app.models.contacts_model import Contact
from app.models.companies_model import Company

from app.schemas.job_offer import ScrapedJobOffer
from app.services.scrapers.scraper_vacancies_linkedin.runner import extract_linked
from app.services.scrapers.scraper_vacancies_adzuna import extract_adzuna
from app.services.scrapers.scraper_vacancies_infojobs.runner import extract_infojobs


async def gather_raw_offers() -> list[dict]:
    raw_offers = []
    scrapers = [
        ("adzuna", extract_adzuna),
        ("linkedin", extract_linked),
        # ("infojobs", extract_infojobs),
    ]

    for name, scraper_func in scrapers:
        print(f"\nIniciando scraper: {name.upper()}...")
        try:
            result = await asyncio.wait_for(scraper_func(), timeout=900)
            if isinstance(result, list):
                raw_offers.extend(result)
                print(f"{name.upper()} terminado. {len(result)} ofertas extraídas.")
        except asyncio.TimeoutError:
            print(f"TIMEOUT en {name.upper()} — saltando scraper")
        except Exception as e:
            print(f"Error crítico en {name.upper()}: {e}")
    return raw_offers


def validate_and_filter_offers(raw_offers: list[dict]) -> list[ScrapedJobOffer]:
    valid_offers = []
    today = datetime.now(timezone.utc)
    
    # 🔥 LISTA NEGRA DE CONSULTORAS DE RRHH, HEADHUNTING Y ETTS
    BLACKLISTED_COMPANIES = [
        # Empresas originales y firmas clave
        "aratalent", "adecco", "randstad", "manpower", "hays", 
        "page personnel", "michael page", "robert walters", 
        "spring professional", "talent search people", 
        "grupo crit", "grupo nortempo", "nortempo", "synergie", 
        "eurofirms", "sibils consulting",
        
        # Agencias de Headhunting y Selección Especializada
        "walters people", "robert half", "experis", "antal international", 
        "catenon", "bros group", "claire joster", "badenoch + clark", 
        "hudson", "oliver james", "frank recruitment group", "nigel frank", 
        "jefferson frank", "wyser",
        
        # ETTs y Plataformas de Contratación masiva
        "jobandtalent", "kelly services", "gi group", "iman temporing", 
        "grupo ctc", "selectiva", "isgf", "ananda",
        
        # Consultoras Organizativas de RRHH y Talento
        "lhh", "korn ferry", "mercer", "cegos", "aon"
    ]

    for offer in raw_offers:
        try:
            validated_offer = ScrapedJobOffer(**offer)
            if not validated_offer.company_name:
                continue
                
            # 🔥 NUEVO FILTRO: Comprobamos si la empresa está en la lista negra
            company_name_lower = validated_offer.company_name.lower()
            es_consultora = any(blacklisted in company_name_lower for blacklisted in BLACKLISTED_COMPANIES)
            
            if es_consultora:
                print(f"      [FILTRO ETT] Descartando oferta de competidor/consultora: {validated_offer.company_name}")
                continue

            public_date = validated_offer.published_at
            if public_date:
                if public_date.tzinfo is None:
                    public_date = public_date.replace(tzinfo=timezone.utc)
                if (today - public_date) > timedelta(hours=72):
                    continue
            valid_offers.append(validated_offer)
        except Exception:
            continue
    return valid_offers


async def process_and_save_offers(valid_offers: list[ScrapedJobOffer]):
    nuevas_guardadas = 0
    actualizadas = 0

    async with AsyncSessionLocal() as session:
        for offer in valid_offers:

            offer_dict = offer.model_dump()
            if offer_dict.get("offer_url"):
                offer_dict["offer_url"] = str(offer_dict["offer_url"])

            p_id = offer_dict.get("portal_id")
            ext_id = str(offer_dict.get("external_id"))

            stmt_check_job = select(JobOffer.id).where(
                JobOffer.portal_id == p_id, JobOffer.external_id == ext_id
            )
            result_job = await session.execute(stmt_check_job)
            job_exists = result_job.scalar_one_or_none()

            if job_exists:
                stmt_update = (
                    update(JobOffer)
                    .where(JobOffer.id == job_exists)
                    .values(
                        title=func.coalesce(offer_dict.get("title"), JobOffer.title),
                        location=func.coalesce(
                            offer_dict.get("location"), JobOffer.location
                        ),
                        offer_url=func.coalesce(
                            offer_dict.get("offer_url"), JobOffer.offer_url
                        ),
                        job_description=func.coalesce(
                            offer_dict.get("job_description"), JobOffer.job_description
                        ),
                        salary_min=func.coalesce(
                            offer_dict.get("salary_min"), JobOffer.salary_min
                        ),
                        salary_max=func.coalesce(
                            offer_dict.get("salary_max"), JobOffer.salary_max
                        ),
                        contract_type=func.coalesce(
                            offer_dict.get("contract_type"), JobOffer.contract_type
                        ),
                        contract_time=func.coalesce(
                            offer_dict.get("contract_time"), JobOffer.contract_time
                        ),
                        work_modality=func.coalesce(
                            offer_dict.get("work_modality"), JobOffer.work_modality
                        ),
                        sector=func.coalesce(offer_dict.get("sector"), JobOffer.sector),
                    )
                )
                await session.execute(stmt_update)
                await session.commit()
                actualizadas += 1
                print(f"-> [REPETIDA] Oferta {ext_id} actualizada.")

            else:
                company_name = offer_dict.get("company_name")
                if not company_name:
                    continue

                print(f"\n[NUEVA OFERTA] {ext_id} - Procesando {company_name}...")
                company_id = None
                company_domain = None

                try:
                    # ==========================================
                    # PASO 1: EXTRAER Y GUARDAR EMPRESA (GEMINI)
                    # ==========================================
                    stmt_check_company = select(Company.id, Company.website).where(
                        Company.name == company_name
                    )
                    result_company = await session.execute(stmt_check_company)
                    company_row = result_company.first()

                    if not company_row:
                        job_desc = offer_dict.get("job_description", "")
                        enriched_company_data = await enrich_company(
                            company_name, job_desc
                        )
                        company_domain = enriched_company_data.get("website")

                        stmt_new_company = (
                            insert(Company)
                            .values(
                                name=company_name,
                                original_offer_id=None, 
                                cif=enriched_company_data.get("cif"),
                                website=company_domain,
                                sector=enriched_company_data.get("sector"),
                                address=enriched_company_data.get("address"),
                                linkedin_url=enriched_company_data.get("linkedin_url"),
                                company_description=enriched_company_data.get(
                                    "company_description"
                                ),
                            )
                            .returning(Company.id)
                        )
                        result_new_company = await session.execute(stmt_new_company)
                        company_id = result_new_company.scalar_one()
                    else:
                        company_id, company_domain = company_row

                    # ==========================================
                    # PASO 2: EXTRAER CONTACTOS (APOLLO MASTER)
                    # ==========================================
                    recruiter_name = offer_dict.get("recruiter_name")
                    recruiter_email = offer_dict.get("recruiter_email")
                    recruiter_phone = offer_dict.get("recruiter_phone")
                    recruiter_linkedin = None
                    recruiter_job_title = None

                    apollo_id = None

                    if not recruiter_email and company_name:
                        titulo_vacante = offer_dict.get("title")
                        
                        apollo_data = await search_and_extract_recruiter(
                            company_name=company_name, 
                            domain=company_domain, 
                            known_name=recruiter_name,
                            offer_title=titulo_vacante
                        )

                        if apollo_data:
                            apollo_name = apollo_data.get("nombre")
                            if apollo_name and (
                                not recruiter_name or " " in apollo_name
                            ):
                                recruiter_name = apollo_name

                            if apollo_data.get("email"):
                                recruiter_email = apollo_data.get("email")
                            if apollo_data.get("telefono"):
                                recruiter_phone = apollo_data.get("telefono")
                            if apollo_data.get("linkedin"):
                                recruiter_linkedin = apollo_data.get("linkedin")
                            if apollo_data.get("titulo"):
                                recruiter_job_title = apollo_data.get("titulo")
                                
                            if apollo_data.get("apollo_contact_id"):
                                apollo_id = apollo_data.get("apollo_contact_id")
                            elif apollo_data.get("id"):
                                apollo_id = apollo_data.get("id")

                    # ==========================================
                    # PASO 3: GUARDADO FINAL EN BD
                    # ==========================================
                    if recruiter_email and "@ara-tech.es" in recruiter_email.lower():
                        print(f"      🛡️ [SEGURIDAD] Bloqueado correo de prueba inyectado: {recruiter_email}")
                        recruiter_email = None
    
                    if (
                        recruiter_name or recruiter_email or recruiter_linkedin
                    ) and company_id:
                        try:
                            safe_name = (
                                recruiter_name
                                if recruiter_name
                                else "Reclutador Desconocido"
                            )

                            stmt_check_contact = select(
                                Contact.id,
                                Contact.email,
                                Contact.phone,
                                Contact.linkedin_url,
                                Contact.job_title,
                            ).where(
                                Contact.company_id == company_id,
                                Contact.full_name == safe_name,
                            )
                            result_contact = await session.execute(stmt_check_contact)
                            existing_contact = result_contact.first()

                            if not existing_contact:
                                stmt_contact = insert(Contact).values(
                                    company_id=company_id,
                                    full_name=safe_name,
                                    email=recruiter_email,
                                    phone=recruiter_phone,
                                    linkedin_url=recruiter_linkedin,
                                    job_title=recruiter_job_title,
                                )
                                await session.execute(stmt_contact)
                            else:
                                (
                                    existing_id,
                                    ex_email,
                                    ex_phone,
                                    ex_linkedin,
                                    ex_job_title,
                                ) = existing_contact
                                update_values = {}

                                if not ex_email and recruiter_email:
                                    update_values["email"] = recruiter_email
                                if not ex_phone and recruiter_phone:
                                    update_values["phone"] = recruiter_phone
                                if not ex_linkedin and recruiter_linkedin:
                                    update_values["linkedin_url"] = recruiter_linkedin
                                if not ex_job_title and recruiter_job_title:
                                    update_values["job_title"] = recruiter_job_title

                                if update_values:
                                    stmt_update_contact = (
                                        update(Contact)
                                        .where(Contact.id == existing_id)
                                        .values(**update_values)
                                    )
                                    await session.execute(stmt_update_contact)
                        except Exception as e:
                            print(f"      [ERROR BD] Fallo al guardar contacto: {e}")

                    # Guardar Oferta
                    offer_dict["company_id"] = company_id
                    for key in [
                        "company_name",
                        "recruiter_name",
                        "recruiter_email",
                        "recruiter_phone",
                    ]:
                        offer_dict.pop(key, None)

                    stmt_offer = (
                        insert(JobOffer).values(**offer_dict).on_conflict_do_nothing()
                    )
                    await session.execute(stmt_offer)
                    await session.commit()

                    nuevas_guardadas += 1
                    print(f" -> [ÉXITO] Oferta guardada en PostgreSQL.")

                    # PASO 4: INYECTAR EN LA SECUENCIA AUTOMÁTICA
                    if recruiter_email and apollo_id:
                        await add_contact_to_apollo_sequence(apollo_id)

                except Exception as e:
                    await session.rollback()
                    print(f"\n[CRITICAL BBDD] Error en el flujo de guardado: {e}\n")

    print(f"\nOfertas extraídas: {len(valid_offers)}")
    print(f"Ofertas REPETIDAS: {actualizadas}")
    print(f"Ofertas NUEVAS: {nuevas_guardadas}")


async def add_contact_to_apollo_sequence(apollo_contact_id: str) -> bool:
    """Añade un contacto a la secuencia de Apollo de forma asíncrona."""
    api_key = os.getenv("APOLLO_API_KEY")
    sequence_id = os.getenv("APOLLO_SEQUENCE_ID")
    email_account_id = os.getenv("APOLLO_EMAIL_ACCOUNT_ID") 
    test_mode = os.getenv("TEST_MODE", "True") == "True"

    if not api_key or not sequence_id or not email_account_id:
        print(
            "      [AVISO] Faltan claves de Apollo (API_KEY, SEQUENCE_ID o EMAIL_ACCOUNT_ID) en el .env"
        )
        return False

    if test_mode:
        print(
            f"      [MODO PRUEBA] Simulando: Inyectando Contacto de Apollo ID {apollo_contact_id} en Secuencia {sequence_id}"
        )
        return True

    url = f"https://api.apollo.io/v1/emailer_campaigns/{sequence_id}/add_contact_ids"
    
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key
    }
    
    payload = {
        "emailer_campaign_id": sequence_id,
        "contact_ids": [apollo_contact_id],
        "send_email_from_email_account_id": email_account_id
    }

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    print(
                        f"      [APOLLO] ✅ Contacto inyectado en secuencia correctamente."
                    )
                    return True
                else:
                    error_data = await resp.text()
                    print(
                        f"      [APOLLO ERROR] Fallo al inyectar en secuencia: {error_data}"
                    )
                    return False
        except Exception as e:
            print(
                f"      [APOLLO EXCEPCIÓN] No se pudo conectar con la API para la secuencia: {e}"
            )
            return False


async def run_scrapers() -> None:
    raw_offers = await gather_raw_offers()
    if not raw_offers:
        return
    valid_offers = validate_and_filter_offers(raw_offers)
    if not valid_offers:
        return
    await process_and_save_offers(valid_offers)


if __name__ == "__main__":
    asyncio.run(run_scrapers())