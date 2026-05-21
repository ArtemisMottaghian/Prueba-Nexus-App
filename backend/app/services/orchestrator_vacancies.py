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
from app.services.enrichment_service import enrich_company

from app.models.user_model import User
from app.models.job_model import JobOffer
from app.models.contacts_model import Contact
from app.models.companies_model import Company 

from app.schemas.job_offer import ScrapedJobOffer
from app.services.scrapers.scraper_vacancies_linkedin.runner import extract_linked
from app.services.scrapers.scraper_vacancies_adzuna import extract_adzuna
from app.services.scrapers.scraper_vacancies_infojobs.runner import extract_infojobs

async def search_in_apollo(company_name: str, company_domain: str = None, known_recruiter_name: str = None) -> dict:
    """
    Integración 100% Apollo API (Requiere Plan Básico).
    """
    api_key = os.getenv("APOLLO_API_KEY")
    if not api_key:
        print("      [AVISO APOLLO] API Key no encontrada en el archivo .env.")
        return {}

    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": api_key
    }

    first_name = ""
    last_name = ""
    linkedin_url = None
    job_title = None

    # --- FASE 1: BÚSQUEDA DEL CONTACTO ---
    if known_recruiter_name:
        parts = known_recruiter_name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        print(f"      [APOLLO] Nombre del scraper detectado: {known_recruiter_name}")
    else:
        search_url = "https://api.apollo.io/v1/mixed_people/api_search"
        search_payload = {
            "person_titles": ["Recruiter", "HR", "Talent Acquisition", "HR Manager", "Selección", "People"],
            "person_locations": ["Spain"],
            "per_page": 1
        }
        
        clean_domain = re.sub(r"https?://(www\.)?", "", company_domain).split('/')[0] if company_domain else None
        if clean_domain:
            search_payload["q_organization_domains"] = clean_domain
        else:
            search_payload["q_organization_name"] = company_name

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(search_url, headers=headers, json=search_payload, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        people = data.get("people", [])
                        if people:
                            person = people[0]
                            first_name = person.get("first_name", "") or ""
                            last_name = person.get("last_name", "") or ""
                            linkedin_url = person.get("linkedin_url")
                            job_title = person.get("title")
                            print(f"      [APOLLO] Perfil encontrado por búsqueda: {first_name} {last_name}")
                        else:
                            print(f"      [APOLLO] No se encontraron reclutadores en {company_name}.")
                            return {}
                    else:
                        print(f"      [APOLLO AVISO] HTTP {response.status}. Revisa los permisos de la API Key.")
                        return {}
        except Exception as e:
            print(f"      [EXCEPCIÓN APOLLO SEARCH] {e}")
            return {}

    # Validación estricta para evitar errores 400 de Apollo
    if not last_name or last_name.strip() == "":
        print(f"      [APOLLO AVISO] No se puede revelar email sin apellidos. Guardando datos básicos.")
        return {"nombre": first_name, "email": None, "telefono": None, "linkedin_url": linkedin_url, "job_title": job_title}

    # --- FASE 2: REVELADO DEL EMAIL ---
    print(f"      [APOLLO] Consultando base de datos para extraer email...")
    match_url = "https://api.apollo.io/v1/people/match"
    match_payload = {
        "first_name": first_name,
        "last_name": last_name,
        "organization_name": company_name,
        "reveal_personal_emails": True
    }
    if company_domain:
        match_payload["domain"] = re.sub(r"https?://(www\.)?", "", company_domain).split('/')[0]

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(match_url, headers=headers, json=match_payload, timeout=15) as match_response:
                email = None
                phone = None
                
                if match_response.status == 200:
                    match_data = await match_response.json()
                    matched_person = match_data.get("person", {})
                    
                    if matched_person:
                        if not linkedin_url: linkedin_url = matched_person.get("linkedin_url")
                        if not job_title: job_title = matched_person.get("title")
                        
                        email = matched_person.get("email")
                        if not email:
                            p_emails = matched_person.get("personal_emails", [])
                            if p_emails and isinstance(p_emails, list) and len(p_emails) > 0:
                                email = p_emails[0]
                        
                        if email:
                            print(f"      [ÉXITO APOLLO] ¡Email extraído!: {email}")
                        else:
                            print(f"      [INFO APOLLO] La persona no tiene email público indexado.")
                else:
                    print(f"      [ERROR APOLLO MATCH] Código {match_response.status}")

                return {
                    "nombre": f"{first_name} {last_name}".strip(),
                    "email": email,
                    "telefono": phone,
                    "linkedin_url": linkedin_url,
                    "job_title": job_title
                }
    except Exception as e:
        print(f"      [EXCEPCIÓN APOLLO MATCH] {e}")

    return {}


async def gather_raw_offers() -> list[dict]:
    raw_offers = []
    scrapers = [
        ("adzuna", extract_adzuna),
        ("linkedin", extract_linked),
        #("infojobs", extract_infojobs),
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

    for offer in raw_offers:
        try:
            validated_offer = ScrapedJobOffer(**offer)
            if not validated_offer.company_name: continue

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
            if offer_dict.get("offer_url"): offer_dict["offer_url"] = str(offer_dict["offer_url"])
                
            p_id = offer_dict.get("portal_id")
            ext_id = str(offer_dict.get("external_id"))

            stmt_check_job = select(JobOffer.id).where(JobOffer.portal_id == p_id, JobOffer.external_id == ext_id)
            result_job = await session.execute(stmt_check_job)
            job_exists = result_job.scalar_one_or_none()

            if job_exists:
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
                print(f"-> [REPETIDA] Oferta {ext_id} actualizada.")

            else:
                company_name = offer_dict.get("company_name")
                if not company_name: continue
                
                print(f"\n[NUEVA OFERTA] {ext_id} - Procesando {company_name}...")
                company_id = None
                company_domain = None
                
                try:
                    # ==========================================
                    # PASO 1: EXTRAER Y GUARDAR EMPRESA (GEMINI)
                    # ==========================================
                    stmt_check_company = select(Company.id, Company.website).where(Company.name == company_name)
                    result_company = await session.execute(stmt_check_company)
                    company_row = result_company.first()

                    if not company_row:
                        job_desc = offer_dict.get("job_description", "")
                        enriched_company_data = await enrich_company(company_name, job_desc)
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
                                company_description=enriched_company_data.get("company_description") 
                            )
                            .returning(Company.id)
                        )
                        result_new_company = await session.execute(stmt_new_company)
                        company_id = result_new_company.scalar_one()
                    else:
                        company_id, company_domain = company_row

                    # ==========================================
                    # PASO 2: EXTRAER CONTACTOS (APOLLO)
                    # ==========================================
                    recruiter_name = offer_dict.get("recruiter_name")
                    recruiter_email = offer_dict.get("recruiter_email")
                    recruiter_phone = offer_dict.get("recruiter_phone")
                    recruiter_linkedin = None
                    recruiter_job_title = None

                    if not recruiter_email and company_name:
                        apollo_data = await search_in_apollo(company_name, company_domain, recruiter_name)
                        
                        if apollo_data:
                            apollo_name = apollo_data.get("nombre")
                            if apollo_name and (not recruiter_name or " " in apollo_name):
                                recruiter_name = apollo_name
                            
                            if apollo_data.get("email"): recruiter_email = apollo_data.get("email")
                            if apollo_data.get("telefono"): recruiter_phone = apollo_data.get("telefono")
                            if apollo_data.get("linkedin_url"): recruiter_linkedin = apollo_data.get("linkedin_url")
                            if apollo_data.get("job_title"): recruiter_job_title = apollo_data.get("job_title")

                    # ==========================================
                    # PASO 3: GUARDADO FINAL EN BD
                    # ==========================================
                    if (recruiter_name or recruiter_email or recruiter_linkedin) and company_id:
                        try:
                            safe_name = recruiter_name if recruiter_name else "Reclutador Desconocido"
                            
                            stmt_check_contact = select(Contact.id, Contact.email, Contact.phone, Contact.linkedin_url, Contact.job_title).where(
                                Contact.company_id == company_id,
                                Contact.full_name == safe_name
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
                                    job_title=recruiter_job_title
                                )
                                await session.execute(stmt_contact)
                            else:
                                existing_id, ex_email, ex_phone, ex_linkedin, ex_job_title = existing_contact
                                update_values = {}
                                
                                if not ex_email and recruiter_email: update_values["email"] = recruiter_email
                                if not ex_phone and recruiter_phone: update_values["phone"] = recruiter_phone
                                if not ex_linkedin and recruiter_linkedin: update_values["linkedin_url"] = recruiter_linkedin
                                if not ex_job_title and recruiter_job_title: update_values["job_title"] = recruiter_job_title
                                    
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
                    for key in ["company_name", "recruiter_name", "recruiter_email", "recruiter_phone"]:
                        offer_dict.pop(key, None)
                    
                    stmt_offer = insert(JobOffer).values(**offer_dict).on_conflict_do_nothing()
                    await session.execute(stmt_offer)
                    await session.commit()

                    nuevas_guardadas += 1
                    print(f" -> [ÉXITO] Oferta guardada en PostgreSQL.")

                except Exception as e:
                    await session.rollback()
                    print(f"\n[CRITICAL BBDD] Error en el flujo de guardado: {e}\n")

    print(f"\nOfertas extraídas: {len(valid_offers)}")
    print(f"Ofertas REPETIDAS: {actualizadas}")
    print(f"Ofertas NUEVAS: {nuevas_guardadas}")


async def run_scrapers() -> None:
    raw_offers = await gather_raw_offers()
    if not raw_offers: return
    valid_offers = validate_and_filter_offers(raw_offers)
    if not valid_offers: return
    await process_and_save_offers(valid_offers)

if __name__ == "__main__":
    asyncio.run(run_scrapers())