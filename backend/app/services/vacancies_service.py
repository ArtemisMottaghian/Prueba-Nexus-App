from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
import re 
from datetime import datetime

from app.db.session import AsyncSessionLocal
from app.models.job_model import JobOffer, JobPortal
from app.models.clients_model import Client
from app.models.contacts_model import Contact
from app.models.entity_model import EntityType
from app.models.leadStatus_model import LeadStatus

# Funcion para obtener el listado (Dashboard y Pantalla de Vacantes)
async def get_vacancies_list(db: AsyncSession, status: Optional[str] = None) -> List[JobOffer]:
    """Obtiene todas las vacantes filtradas opcionalmente por estado."""
    try:
        async with AsyncSessionLocal() as session:
            query = select(JobOffer)

            # Filtro si nos pasan un estado
            if status:
                query = query.where(JobOffer.status == status)

            # Ordenamos por las mas recientes primero
            query = query.order_by(JobOffer.published_at.desc())

            result = await session.execute(query)

            return result.scalars().all()
    except Exception as e:
        raise e

# detalle de una vacante por el ID
async def get_vacancy_by_id(db: AsyncSession, vacancy_id: int) -> Optional[JobOffer]:
    try:
        async with AsyncSessionLocal() as session:
            # buscar por id
            query = select(JobOffer).where(JobOffer.id == vacancy_id)

            result = await session.execute(query)

            # Devuelve el objeto o None si no existe
            return result.scalar_one_or_none()
    except Exception as e:
        raise e


async def create_vacancy(job_data: dict) -> JobOffer:
    """
    Guarda una nueva vacante, genera el Cliente prospecto si no existe,
    y añade al Reclutador como Contacto.
    """
    try:
        async with AsyncSessionLocal() as session:
            # 1. Evitar duplicados por ID externo
            query = select(JobOffer).where(JobOffer.external_id == str(job_data.get("external_id")))
            result = await session.execute(query)
            existing_job = result.scalar_one_or_none()

            if existing_job:
                return existing_job

            # 2. Parsear el salario (de texto a Integers)
            s_min, s_max = None, None
            salary_str = job_data.get("salary_eur", "")
            if salary_str and isinstance(salary_str, str) and salary_str != "No especificado":
                # Extraemos solo los números
                nums = re.findall(r'\d+', salary_str.replace('.', ''))
                if len(nums) >= 2:
                    s_min, s_max = int(nums[0]), int(nums[1])
                elif len(nums) == 1:
                    s_min = int(nums[0])

            # 3. Parsear la fecha de publicación
            pub_date = None
            date_str = job_data.get("publish_date")
            if date_str:
                try:
                    # LinkedIn devuelve fechas tipo ISO, las pasamos a datetime de Python
                    pub_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                except Exception:
                    pass

            # 4. Obtener o crear el Portal (LinkedIn)
            portal_query = select(JobPortal).where(JobPortal.name.ilike("%linkedin"))
            portal_result = await session.execute(portal_query)
            portal = portal_result.scalar_one_or_none()

            if not portal:
                portal = JobPortal(name="LinkedIn", base_url="https://linkedin.com")
                session.add(portal)
                await session.flush() #Obtenemos portal.id
                
            # 5. Mapear al modelo exacto
            new_job = JobOffer(
                external_id=str(job_data.get("external_id", "")),
                title=job_data.get("title", "Sin título")[:255], 
                company_name=job_data.get("company", "")[:255], 
                location=job_data.get("location", "")[:255],
                offer_url=job_data.get("offer_url", ""),
                job_description=job_data.get("description", ""), 
                company_description=job_data.get("company_description", ""),
                published_at=pub_date,
                sector=job_data.get("sector_name", "")[:255],
                salary_min=s_min,
                salary_max=s_max,
                contract_type=job_data.get("contract_type", "")[:50],
                contract_time=job_data.get("contract_time", "")[:50],
                work_modality=job_data.get("modality", "")[:50],
                portal_id=portal.id
            )

            # Obtenemos new_job.id para vincular al cliente
            session.add(new_job)
            await session.flush()

            # 6. Lógica de Cliente (Empresa)
            company_name = job_data.get("company")
            client = None
            if company_name:
                # ¿Ya existe esta empresa en nuestra BBDD?
                client_query = select(Client).where(Client.company_name == company_name)
                client_result = await session.execute(client_query)
                client = client_result.scalar_one_or_none()

                if not client:
                    # Si no existe, la creamos como prospecto
                    client = Client(
                        company_name=company_name[:255],
                        source_id=portal.id,
                        original_offer_id=new_job.id,
                        entity_type=EntityType.scraping_prospect,
                        lead_status=LeadStatus.new
                    )
                    session.add(client)
                    await session.flush() # Obtenemos client.id para vincular al reclutador

                # 7. Lógica de Contacto (Reclutador)
                recruiter_name = job_data.get("recruiter_name")
                recruiter_url = job_data.get("recruiter_url", "")

                if recruiter_name and recruiter_name not in ["No especificado", "Nombre no extraíble limpiamente", ""]:
                    # Comprobamos que no hayamos guardado ya a este reclutador en esta empresa
                    contact_query = select(Contact).where(
                        Contact.client_id == client.id, 
                        Contact.full_name == recruiter_name
                    )
                    contact_result = await session.execute(contact_query)
                    existing_contact = contact_result.scalar_one_or_none()

                    if not existing_contact:
                        new_contact = Contact(
                            client_id=client.id,
                            full_name=recruiter_name[:255],
                            job_title="Reclutador HR",
                            linkedin_url=recruiter_url[:255]
                        )
                        session.add(new_contact)

            # 8. Guardado final de toda la cadena
            await session.commit()
            
            return new_job
            
    except Exception as e:
        print(f"Error específico en create_vacancy: {type(e).__name__} - {e}")
        raise e