import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy.dialects.postgresql import insert

from app.db.session import AsyncSessionLocal
from app.db.connection import Base

from app.models.user_model import User        
from app.models.search_model import Search, SearchResult
from app.models.job_model import JobOffer, JobPortal 
from app.models.clients_model import Client
from app.models.trakingHistory_model import TrackingHistory
from app.models.contacts_model import Contact
from app.models.candidates_model import Candidate

from app.schemas.job_offer import ScrapedJobOffer
from app.services.scrapers.linkedin.linkedin_runner import extract_linked
from app.services.scrapers.adzuna import extract_adzuna
from app.services.scrapers.infojobs.infojobs_runner import extract_infojobs
from app.services.enrichment_service import search_in_dropcontact, search_with_phantombuster
from app.services.scraper_logs_service import log_scraper_error

async def run_scrapers():
    print("Comenzando busqueda de ofertas...")

    results = await asyncio.gather(
        extract_adzuna(),
        # Activar las funciones cuando se sepa que funcionan bien
        # extract_zenrows(),
       # extract_linked(),
       # extract_infojobs(),
        return_exceptions=True,
    )

    raw_offers = []
    # Volcamos todos los resultados en raw_offer
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            scraper_names = ["adzuna", "linkedin", "infojobs"]   # añadir "zenrows" cuando se active
            name = scraper_names[i] if i < len(scraper_names) else f"scraper_{i}"
            await log_scraper_error(
                error_code=f"SCRAPER_{name.upper()}_CRITICAL",
                message=f"scraper={name} | stage=gather | exc={result}"
            )
        elif isinstance(result, list):
            raw_offers.extend(result)

    print(f"OFERTAS TOTALES RECOGIDAS: {len(raw_offers)}")
    if not raw_offers:
        return

    print(" DETALLE DE LAS OFERTAS EXTRAÍDAS")
    for indice, oferta in enumerate(raw_offers, 1):
        print(f"\nOFERTA {indice}:")
        for clave, valor in oferta.items():
            print(f"   {clave}: {valor}")

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

                # FILTRO DE TIEMPO. DESACTIVAR SI NO SE RECIBEN OFERTAS Y SE QUIEREN HACER PRUEBAS.
                # POR DEFECTO, ESTE FILTRO DESCARTA LAS OFERTAS QUE LLEVEN MAS DE 24 PUBLICADAS.
                time_filter = today - public_date
                if time_filter > timedelta(hours=72):
                    continue

            valid_offers.append(validated_offer)
        except Exception as e:
            continue

    print(f"Ofertas validadas: {len(valid_offers)}")
    if not valid_offers:
        return

    print("Iniciando fase de enriquecimiento")
    
    async def enrich_single_offer(offer):
        offer_dict = offer.model_dump()
        obtained_email = offer_dict.get("recruiter_email")
        company = offer_dict.get("company_name")
        recruiter = offer_dict.get("recruiter_name")

        if not obtained_email:
            # Tenemos el nombre, pero no el correo -> A Dropcontact directo
            if recruiter and company:
                obtained_email = await search_in_dropcontact(name=recruiter, company=company)

            # No tenemos ni el nombre ni el correo -> A PhantomBuster primero
            elif company and not recruiter:
                phantom_data = await search_with_phantombuster(company)
                
                if phantom_data and phantom_data.get("nombre"):
                    recruiter = f"{phantom_data['nombre']} {phantom_data.get('apellidos', '')}".strip()

                    obtained_email = await search_in_dropcontact(name=recruiter, company=company)

        # limpieza url
        if offer_dict.get("offer_url"):
            offer_dict["offer_url"] = str(offer_dict["offer_url"])

        return {
            "offer_data": offer_dict,
            "recruiter_name": recruiter,
            "recruiter_email": obtained_email
        }

    # Lista de tareas para hacer todo a la vez
    enrichment_tasks = [enrich_single_offer(offer) for offer in valid_offers]
    enriched_data_list = await asyncio.gather(*enrichment_tasks, return_exceptions=True)

    #guardado
    print(f"Guardando {len(enriched_data_list)} ofertas enriquecidas en BD...")
    async with AsyncSessionLocal() as session:
        try:
            for item in enriched_data_list:
                # si falla alguna la ignoramos
                if isinstance(item, Exception):
                    print(f"Error enriqueciendo oferta: {item}")
                    continue

                offer_data = item["offer_data"]
                recruiter_name = item["recruiter_name"]
                recruiter_email = item["recruiter_email"]

                # Limpiamos datos que no van en la tabla JobOffer
                offer_data.pop("recruiter_name", None)
                offer_data.pop("recruiter_email", None)
                offer_data.pop("fingerprint", None)

                # Insertamos Oferta
                stmt_offer = insert(JobOffer).values(**offer_data)
                stmt_offer = stmt_offer.on_conflict_do_nothing(
                    constraint="unique_offer_per_portal"
                ).returning(JobOffer.id)

                result_offer = await session.execute(stmt_offer)
                new_offer_id = result_offer.scalar_one_or_none()


    #------------------------------------------------------------------------------------------------------------- Revisar
                # Solo creamos Cliente y Contacto si la oferta es totalmente nueva
                if new_offer_id:
                    company_name = offer_data.get("company_name")

                    # Insertamos Cliente
                    stmt_client = insert(Client).values(
                        original_offer_id=new_offer_id,
                        company_name=company_name,
                        entity_type="scraping_prospect",
                        lead_status="new"
                    ).returning(Client.id)

                    result_client = await session.execute(stmt_client)
                    new_client_id = result_client.scalar_one()

                    # Insertamos Contacto (Incluso si solo tenemos "HR Department" como nombre)
                    stmt_contact = insert(Contact).values(
                        client_id=new_client_id,
                        full_name=recruiter_name or "HR Department",
                        email=recruiter_email,
                        job_title="HR / Recruiter"
                    )
                    await session.execute(stmt_contact)

            # confirmacion de todas las inserciones
            await session.commit()
            print("✅ Datos enriquecidos y guardados con éxito")

        except Exception as e:
            await session.rollback()
            await log_scraper_error(
                error_code="SCRAPPER_ORCHESTRATOR_DB",
                message=f"stage=db_save | exc={e}"
            )
            print("❌ Error crítico al guardar en base de datos")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_scrapers())