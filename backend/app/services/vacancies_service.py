from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
import re 
from datetime import datetime
from sqlalchemy import update

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
        query = select(JobOffer)
        # Filtro si nos pasan un estado
        if status:
            query = query.where(JobOffer.status == status)

        # Ordenamos por las mas recientes primero
        query = query.order_by(JobOffer.published_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    except Exception as e:
        raise e

# Detalle de una vacante por el ID
async def get_vacancy_by_id(db: AsyncSession, vacancy_id: int) -> Optional[JobOffer]:

    """Obtiene una vacante por su ID."""
    try:
        query = select(JobOffer).where(JobOffer.id == vacancy_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()
    except Exception as e:
        raise e


async def create_vacancy(job_data: dict, db: AsyncSession = None) -> JobOffer:
    """
    Guarda una nueva vacante, genera el Cliente prospecto si no existe,
    y añade al Reclutador como Contacto.
    """

    async def _execute(session: AsyncSession):

        # 1. Evitar duplicados por ID externo
        query = select(JobOffer).where(JobOffer.external_id == str(job_data.get("external_id")))
        result = await session.execute(query)
        existing_job = result.scalar_one_or_none()

        if existing_job:
            return existing_job

        # 2. Parsear el salario
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
                
        # 5. Crear vacante
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

        # 6. Cliente (Empresa)
        company_name = job_data.get("company")
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

            # 7. Contacto (Reclutador)
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

        # 8. Commit solo si la sesión es interna
        if db is None:
            await session.commit()
            
        return new_job
    try:
        if db is not None:
            return await _execute(db)
        else:
            async with AsyncSessionLocal() as session:
                return await _execute(session)

    except Exception as e:
        print(f"Error específico en create_vacancy: {type(e).__name__} - {e}")
        raise e

async def get_vacancies_filtered(
    db: AsyncSession,
    status: Optional[str] = None,
    sector: Optional[str] = None,
    location: Optional[str] = None
) -> List[JobOffer]:
    """Obtiene vacantes filtradas por estado, sector y ubicación."""
    try:
        query = select(JobOffer)
        if status:
            query = query.where(JobOffer.status == status)
        if sector:
            query = query.where(JobOffer.sector == sector)
        if location:
            query = query.where(JobOffer.location.ilike(f"%{location}%"))
        query = query.order_by(JobOffer.published_at.desc())
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise e

async def set_favorite(db: AsyncSession, vacancy_id: int, favorite: bool) -> None:
    """Marca o desmarca una vacante como favorita."""
    try:
        query = select(JobOffer).where(JobOffer.id == vacancy_id)
        result = await db.execute(query)
        vacancy = result.scalar_one_or_none()
        if vacancy:
            vacancy.is_favorite = favorite
            await db.commit()
    except Exception as e:
        raise e

async def apply_bulk_action(db: AsyncSession, vacancy_ids: List[int], action: str) -> None:
    """Aplica una acción masiva sobre un conjunto de vacantes."""
    try:
        query = select(JobOffer).where(JobOffer.id.in_(vacancy_ids))
        result = await db.execute(query)
        vacancies = result.scalars().all()

        for vacancy in vacancies:
            if action == "discard":
                vacancy.status = "discarded"
            elif action == "delete":
                await db.delete(vacancy)

        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e

#actualizar estado de vacante
async def update_vacancy_status(db: AsyncSession, vacancy_id: int, new_status: str):
    clean_status = new_status.strip().lower()
    
    # traductar del ingles a español
    status_map = {
        "nueva": "detected",
        "nuevo": "detected",
        "nuevas": "detected",
        "nuevos": "detected",
        
        "contactada": "contacted",
        "contactado": "contacted",
        "contactadas": "contacted",
        "contactados": "contacted",
        
        "en proceso": "negotiating",
        "en progreso": "negotiating",
        
        "descartada": "discarded",
        "descartado": "discarded",
        "descartadas": "discarded",
        "descartados": "discarded",
        
        "ganada": "won",
        "ganado": "won"
    }
    
    db_status = status_map.get(clean_status, new_status)

    try:
        resultado = await db.execute(select(JobOffer).where(JobOffer.id == vacancy_id))
        vacancy = resultado.scalars().first()
        
        if vacancy:
            vacancy.status = db_status
            await db.commit()
            return True
        return False
    except Exception as e:
        await db.rollback()
        print(f"Error al actualizar el estado de la vacante {vacancy_id}: {e}")
        raise e

_COUNTRY_SUFFIXES = [", Spain", ", España", ", ES"]

_TRANSLATIONS = {
    "Balearic Islands": "Islas Baleares",
    "Illes Balears": "Islas Baleares",
    "Canary Islands": "Islas Canarias",
    "Community of Madrid": "Madrid",
    "Catalonia": "Cataluña",
    "Valencian Community": "Comunidad Valenciana",
    "Basque Country": "País Vasco",
    "Andalusia": "Andalucía",
    "Aragon": "Aragón",
    "Castile and León": "Castilla y León",
    "Castile-La Mancha": "Castilla-La Mancha",
    "Navarre": "Navarra",
}

_EXCLUDED = {"españa", "spain", "", "sin ubicación"}


def _normalize_location(location: str) -> str | None:
    loc = location.strip()
    if loc.lower() in _EXCLUDED:
        return None

    # Eliminar sufijo de país
    for suffix in _COUNTRY_SUFFIXES:
        if loc.endswith(suffix):
            loc = loc[: -len(suffix)].strip()
            break

    if not loc or loc.lower() in _EXCLUDED:
        return None

    # Tomar el último componente separado por coma (nivel provincia/comunidad)
    parts = [p.strip() for p in loc.split(",")]
    name = parts[-1] if len(parts) > 1 else parts[0]

    return _TRANSLATIONS.get(name, name)


async def get_distinct_locations(db: AsyncSession) -> List[str]:
    """Devuelve la lista de localizaciones únicas normalizadas de las vacantes."""
    result = await db.execute(
        select(JobOffer.location)
        .where(JobOffer.location.isnot(None))
        .where(JobOffer.location != "")
        .distinct()
    )
    raw_locations = [row[0] for row in result.all()]

    normalized: set[str] = set()
    for loc in raw_locations:
        name = _normalize_location(loc)
        if name:
            normalized.add(name)

    return sorted(normalized)