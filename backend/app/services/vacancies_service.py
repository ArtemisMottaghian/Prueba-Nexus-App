from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
import re 
from datetime import datetime

from app.db.session import AsyncSessionLocal
from app.db.models import JobOffer, OfferStatus, JobPortal

# Funcion para obtener el listado (Dashboard y Pantalla de Vacantes)
async def get_vacancies_list(db: AsyncSession, status: Optional[str] = None) -> List[JobOffer]:
    """
    Obtiene todas las vacantes.
    Si se pasa 'status' (ej: 'detected), filtra por ese estado
    Mapping de estados habituales:
    - 'nuevas' -> OfferStatus.detected
    - 'en contacto' -> OfferStatus.contacted
    - 'en negociacion' -> OfferStatus.negotiating
    """
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

# detalle de una vacante
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
    Guarda una nueva vacante en la base de datos desde el scraper,
    adaptando los datos crudos al modelo de SQLAlchemy.
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

            # 4. Mapear al modelo exacto
            new_job = JobOffer(
                external_id=str(job_data.get("external_id", "")),
                title=job_data.get("title", "No title")[:255],
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
                work_modality=job_data.get("modality", "")[:50]
            )

            # Opcional: Si tienes LinkedIn registrado en tu tabla JobPortal, lo asociamos
            portal_query = select(JobPortal).where(JobPortal.name.ilike("%linkedin%"))
            portal_result = await session.execute(portal_query)
            portal = portal_result.scalar_one_or_none()
            if portal:
                new_job.portal_id = portal.id

            # 5. Guardar en BD
            session.add(new_job)
            await session.commit()
            
            return new_job
            
    except Exception as e:
        print(f"Error específico en create_vacancy: {type(e).__name__} - {e}")
        raise e



async def apply_bulk_action(
    db: AsyncSession,
    vacancy_ids: List[int],
    action: str
) -> None:
    """
    Aplica una acción masiva sobre un listado de vacantes.
    - 'descartar' → cambia el estado a 'discarded'
    - 'eliminar'  → borra las vacantes de la BD
    """
    try:
        async with AsyncSessionLocal() as session:
            query = select(JobOffer).where(JobOffer.id.in_(vacancy_ids))
            result = await session.execute(query)
            vacancies = result.scalars().all()

            for vacancy in vacancies:
                if action == "discard":
                    vacancy.status = OfferStatus.discarded
                elif action == "delete":
                    await session.delete(vacancy)

            await session.commit()
    except Exception as e:
        await session.rollback()
        raise e



async def get_vacancies_filtered(
    db: AsyncSession,
    status: Optional[str] = None,
    sector: Optional[str] = None,
    location: Optional[str] = None
) -> List[JobOffer]:
    """
    Obtiene vacantes filtrando por estado, sector y/o ubicación.
    Todos los filtros son opcionales.
    """
    try:
        async with AsyncSessionLocal() as session:
            query = select(JobOffer)

            if status:
                query = query.where(JobOffer.status == status)
            if sector:
                query = query.where(JobOffer.sector == sector)
            if location:
                query = query.where(JobOffer.location == location)

            query = query.order_by(JobOffer.published_at.desc())

            result = await session.execute(query)
            return result.scalars().all()
    except Exception as e:
        raise e

async def set_favorite(
    db: AsyncSession,
    vacancy_id: int,
    favorite: bool
) -> None:
    """
    Marca o desmarca una vacante como favorita.
    """
    try:
        async with AsyncSessionLocal() as session:
            query = select(JobOffer).where(JobOffer.id == vacancy_id)
            result = await session.execute(query)
            vacancy = result.scalar_one_or_none()

            if vacancy:
                vacancy.is_favorite = favorite
                await session.commit()
    except Exception as e:
        await session.rollback()
        raise e