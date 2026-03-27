import asyncio

from datetime import datetime, timedelta, timezone

# import re
# import unicodedata
from sqlalchemy.dialects.postgresql import insert

from app.db.session import AsyncSessionLocal
from app.db.models import JobOffer, Client, Contact
from app.schemas.job_offer import ScrapedJobOffer
from app.services.scrapers.linkedin.linkedin_runner import extract_linked
from app.services.scrapers.adzyna import extract_adzuna
from app.services.scrapers.infojobs.infojobs_runner import extract_infojobs


async def run_scrapers():
    print("Comenzando busqueda de ofertas...")

    results = await asyncio.gather(
        # extract_adzuna(),
        # Activar las funciones cuando se sepa que funcionan bien
        # extract_zenrows(),
        # extract_linked(),
        extract_infojobs(),
        return_exceptions=True,
    )

    raw_offers = []
    # Volcamos todos los resultados en raw_offer
    for result in results:
        if isinstance(result, list):
            raw_offers.extend(result)

    print(f"OFERTAS TOTALES RECOGIDAS: {len(raw_offers)}")
    if not raw_offers:
        return

    print("🔍 DETALLE DE LAS OFERTAS EXTRAÍDAS")
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
                if time_filter > timedelta(hours=24):
                    continue

            valid_offers.append(validated_offer)
        except Exception as e:
            continue

    print(f"Ofertas validadas: {len(valid_offers)}")
    if not valid_offers:
        return

    # EL CODIGO DE ABAJO SIRVE PARA INSERTAR DIRECTAMENTE LOS DATOS EN LA BBDD
    # SIN ENRIQUECER LOS DATOS NI NADA. USAR MIENTRAS NO ESTEN ACTIVAS LAS HERRAMIENTAS
    # DE TERCEROS Y PARA HACER PRUEBAS.
    async with AsyncSessionLocal() as session:
        try:
            for offer in valid_offers:
                offer_data = offer.model_dump()

                # Aqui se sacan los datos de Contacts para que no de error en JobOffer
                r_name = offer_data.pop("recruiter_name", None)
                r_email = offer_data.pop("recruiter_email", None)
                offer_data.pop("fingerprint", None)

                if offer_data.get("offer_url"):
                    offer_data["offer_url"] = str(offer_data["offer_url"])

                stmt_offer = insert(JobOffer).values(**offer_data)

                stmt_offer = stmt_offer.on_conflict_do_nothing(
                    constraint="unique_offer_per_portal"
                ).returning(JobOffer.id)

                result_offer = await session.execute(stmt_offer)
                new_offer_id = result_offer.scalar_one_or_none()

                # Creacion del Cliente asociado a la oferta
                if new_offer_id:
                    stmt_client = (
                        insert(Client)
                        .values(
                            original_offer_id=new_offer_id,
                            company_name=offer_data["company_name"],
                            entity_type="scraping_prospect",
                            lead_status="new",
                        )
                        .returning(Client.id)
                    )

                    result_client = await session.execute(stmt_client)
                    new_client_id = result_client.scalar_one()

                    # Creacion de Contacto asociado al cliente
                    if r_name or r_email:
                        stmt_contact = insert(Contact).values(
                            client_id=new_client_id,
                            full_name=r_name,
                            email=r_email,
                            job_title="HR / Recruiter",
                        )
                        await session.execute(stmt_contact)

            # Confirmar la transacción
            await session.commit()
            print("Datos guardados")

        except Exception as e:
            await session.rollback()
            import traceback

            print("Error al guardar")
            traceback.print_exc()


# enriched_data_list = []

# for offer in valid_offers:
#     offer_dict = offer.model_dump()

#     obtained_email = offer_dict.get("recruiter_email")
#     company = offer_dict.get("company_name")
#     recruiter = offer_dict.get("recruiter_name")

#     if not obtained_email:

#         # Busqueda en Dropcontact
#         if recruiter and company:
#             obtained_email = await search_in_dropcontact(
#                 name=recruiter, company=company
#             )

#         # Busqueda en PhantomBuster y posteriormente el solo lo hace en Dropcontact
#         elif company and not recruiter:
#             phantom_data = await search_with_phantombuster(company)
#             if phantom_data:
#                 recruiter = f"{phantom_data['nombre']} {phantom_data['apellidos']}"
#                 obtained_email = phantom_data["email"]

#     if offer_dict.get("offer_url"):
#         offer_dict["get_url"] = str(offer_dict["offer_url"])

#     enriched_data_list.append({
#         "offer_data": offer_dict,
#         "recruiter_name": recruiter,
#         "recruiter_email": obtained_email
#     })

#     if not enriched_data_list:
#         return

#     async with AsyncSessionLocal() as session:
#         try:
#             for item in enriched_data_list:
#                 offer_data = item["offer_data"]
#                 recruiter_name = item["recruiter_name"]
#                 recruiter_email = item["recruiter_email"]

#                 offer_data.pop("recruiter_name", None)
#                 offer_data.pop("recruiter_email", None)

#                 stmt_offer = insert(JobOffer).values(**offer_data)
#                 stmt_offer = stmt_offer.on_conflict_do_nothing().returning(JobOffer.id)

#                 result_offer = await session.execute(stmt_offer)
#                 new_offer_id = result_offer.scalar_one_or_none()

#                 if new_offer_id:
#                     company_name = offer_data.get("company_name")

#                     stmt_client = insert(Client).values(
#                         original_offer_id=new_offer_id,
#                         company_name=company_name,
#                         entity_type="scraping_prospect",
#                         lead_status="new"
#                     ).returning(Client.id)

#                     result_client = await session.execute(stmt_client)
#                     new_client_id = result_client.scalar_one()

#                     if recruiter_name or recruiter_email:
#                         stmt_contact = insert(Contact).values(
#                             client_id=new_client_id,
#                             full_name=recruiter_name or "HR Department",
#                             email=recruiter_email,
#                             job_title="HR / Recruiter"
#                         )

#                         await session.execute(stmt_contact)

#             await session.commit()

#         except Exception as e:
#             await session.rollback()

if __name__ == "__main__":
    asyncio.run(run_scrapers())
