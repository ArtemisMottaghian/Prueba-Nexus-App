import re
from fastapi import HTTPException
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from app.models.user_model import User, UserRole
from app.schemas.users_schemas import UserType
from app.models.job_model import JobOffer, JobPortal, JobApplication
from app.models.candidates_model import Candidate
from app.models.contacts_model import Contact
from app.models.entity_model import EntityType
from app.models.leadStatus_model import LeadStatus
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import delete
from app.models.job_model import VacancyAssignment
from app.models.assignments_model import VacancyAssignment





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

async def set_favourite(db: AsyncSession, vacancy_id: int, favourite: bool) -> None:
    """Marca o desmarca una vacante como favorita."""
    try:
        query = select(JobOffer).where(JobOffer.id == vacancy_id)
        result = await db.execute(query)
        vacancy = result.scalar_one_or_none()
        if vacancy:
            vacancy.is_favourite = favourite
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

# actualizar estado de vacante
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

async def assign_hr_to_vacancies(db: AsyncSession, hr_id: int, vacancy_ids: List[int]) -> int:
    """
    Añade un HR a una vacante (puede haber múltiples HR en la misma).
    """
    if not vacancy_ids:
        return 0

    try:
        # Validar usuario
        user_query = select(User).where(User.id == hr_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="El usuario de destino no existe.")
        if user.role != UserRole.hr_manager:
            raise HTTPException(status_code=400, detail=f"El usuario debe tener el rol de RRHH.")
        
        values_to_insert = [{"vacancy_id": v_id, "user_id": hr_id} for v_id in vacancy_ids]
        
        stmt = pg_insert(VacancyAssignment).values(values_to_insert)
        stmt = stmt.on_conflict_do_nothing() 

        result = await db.execute(stmt)
        await db.commit()

        return result.rowcount
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error al asignar vacantes: {e}")
        raise e


async def remove_hr_assignment(db: AsyncSession, hr_id: int, vacancy_ids: List[int], is_admin: bool = False) -> int:
    """
    Quita a un HR específico de las vacantes indicadas.
    """
    if not vacancy_ids:
        return 0

    try:
        stmt = (
            delete(VacancyAssignment)
            .where(
                VacancyAssignment.vacancy_id.in_(vacancy_ids),
                VacancyAssignment.user_id == hr_id
            )
        )

        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount
    except Exception as e:
        await db.rollback()
        raise e


async def get_vacancies_by_hr(db: AsyncSession, hr_id: int) -> List[JobOffer]:
    """
    Obtiene las vacantes donde este HR está dentro de la lista de asignados.
    """
    try:
        # BUSCAMOS SI EL HR ESTÁ EN LA LISTA DE MANAGERS DE LA OFERTA
        query = (
            select(JobOffer)
            .where(JobOffer.managers.any(User.id == hr_id))
            .order_by(JobOffer.published_at.desc())
        )

        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        print(f"Error al obtener las vacantes: {e}")
        raise e
    
async def get_suitable_candidates(db: AsyncSession, vacancy_id: int) -> list[dict]:
    # Obtener vacante
    vacancy = await get_vacancy_by_id(db, vacancy_id)
    if vacancy is None:
        return None 

    # Extraer keywords de la vacante
    raw_text = f"{vacancy.sector or ''} {vacancy.job_description or ''}"
    vacancy_keywords = {
        w.lower()
        for w in re.split(r"[\s,.()\[\]]+", raw_text)
        if len(w) >= 3
    }

    # Candidatos disponibles
    result = await db.execute(
        select(Candidate).where(Candidate.status.in_(["active", "passive"]))
    )
    candidates = result.scalars().all()

    # Aplicaciones ya existentes para esta vacante (mostrar estado)
    apps_result = await db.execute(
        select(JobApplication).where(JobApplication.offer_id == vacancy_id)
    )
    apps_by_candidate = {
        app.candidate_id: app.status.value
        for app in apps_result.scalars().all()
    }

    # Calcular score y construir respuesta
    output = []
    for c in candidates:
        candidate_skills = [
            s.strip().lower()
            for s in (c.skills or "").split(",")
            if s.strip()
        ]
        if candidate_skills:
            matches = sum(1 for s in candidate_skills if s in vacancy_keywords)
            score = round(matches / len(candidate_skills) * 100)
        else:
            score = 0
        
        output.append({
            "id": c.id,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "speciality": c.skills or "Sin especificar",
            "location": c.location or "No indicada",
            "status": c.status.value if hasattr(c.status, "value") else str(c.status),
            "experience": c.experience or "Consultar CV",
            "email": c.email,
            "is_favourite": bool(c.is_favourite),
            "verified": bool(c.verified),
            "match_score": score,
            "application_status": apps_by_candidate.get(c.id),
        })
    
    output.sort(key=lambda x: (x["match_score"], x["id"]), reverse=True)
    return output