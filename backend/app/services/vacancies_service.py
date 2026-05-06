import re
from fastapi import HTTPException
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.user_model import User, UserRole
from app.schemas.users_schemas import UserType
from app.models.job_model import JobOffer, JobPortal, JobApplication
from app.models.candidates_model import Candidate
from app.models.contacts_model import Contact
from app.models.entity_model import EntityType
from app.models.leadStatus_model import LeadStatus
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import delete
from app.models.assignments_model import VacancyAssignment

from datetime import datetime, timezone
from app.db.session import AsyncSessionLocal
from app.models.trakingHistory_model import TrackingHistory
from app.schemas.vacancies_schemas import CandidateTrackingCreate




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



async def get_vacancy_detail(db: AsyncSession, vacancy_id: int) -> Optional[JobOffer]:
    """Obtiene una vacante por su ID con la relación company cargada."""
    try:
        from sqlalchemy.orm import selectinload
        query = (
            select(JobOffer)
            .options(selectinload(JobOffer.company))
            .where(JobOffer.id == vacancy_id)
        )
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

async def assign_hr_to_vacancies(db: AsyncSession, hr_id:int, vacancy_ids: List[int]) -> int:
    """
    Asigna masivamente un conjunto de vacantes a un usuario interno de RRHH.
    Valida que el usuario exista y tenga el rol correcto antes de proceder.
    """

    if not vacancy_ids:
        return

    try:
        user_query = select(User).where(User.id == hr_id)
        user_result = await db.execute(user_query)
        user =  user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="El usuario de destino no existe.")

        if user.role not in [UserType.hr_manager, UserType.company, UserType.admin]:
            raise HTTPException(
                status_code=400,
                detail=f"El usuario no tiene un rol válido para gestionar o asignarse vacantes."
            )

        rows = [{"vacancy_id": vid, "user_id": hr_id} for vid in vacancy_ids]
        stmt = pg_insert(VacancyAssignment).values(rows).on_conflict_do_nothing()
        result = await db.execute(stmt)
        await db.commit()

        return result.rowcount
    
    except HTTPException:
        raise
            
    except Exception as e:
        await db.rollback()
        print(f"Error al asignar vacantes: {e}")
        raise e

async def get_vacancies_by_hr(db: AsyncSession, hr_id: int) -> List[JobOffer]:
    """
    Obtiene el listado de vacantes asignadas a un gestor de RRHH específico.
    """

    try:
        query = (
            select(JobOffer)
            .join(VacancyAssignment, VacancyAssignment.vacancy_id == JobOffer.id)
            .where(VacancyAssignment.user_id == hr_id)
        )

        query = query.order_by(JobOffer.published_at.desc())

        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        print(f"Error al obtener las vacatantes: {e}")
        raise e


async def remove_hr_assignment(db: AsyncSession, hr_id: int, vacancy_ids: List[int], is_admin: bool = False) -> int:
    """
    Elimina la asignación de un gestor de RRHH sobre un conjunto de vacantes.
    Si is_admin=True puede quitar asignaciones de cualquier usuario.
    """
    if not vacancy_ids:
        return 0

    try:
        stmt = (
            delete(VacancyAssignment)
            .where(VacancyAssignment.vacancy_id.in_(vacancy_ids))
            .where(VacancyAssignment.user_id == hr_id)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount

    except Exception as e:
        await db.rollback()
        print(f"Error al quitar asignaciones: {e}")
        raise e




async def get_suitable_candidates(db: AsyncSession, vacancy_id: int) -> list[dict]:
    # Obtener vacante
    vacancy = await get_vacancy_by_id(db, vacancy_id)
    if vacancy is None:
        return None # El router lanzara 404

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


async def update_portal_last_run(portal_name: str, status: str = "ok") -> None:
    """Actualiza la fecha y estado de la última ejecución del scraper."""
    try:
        async with AsyncSessionLocal() as session:
            query = select(JobPortal).where(JobPortal.name.ilike(f"%{portal_name}%"))
            result = await session.execute(query)
            portal = result.scalar_one_or_none()
            if portal:
                portal.last_run_at = datetime.now(timezone.utc)
                portal.last_run_status = status
                await session.commit()
    except Exception as e:
        print(f"Error actualizando last_run de {portal_name}: {e}")

async def get_candidate_tracking(db: AsyncSession, vacancy_id: int) -> list[dict]:
    apps_result = await db.execute(
        select(JobApplication).where(JobApplication.offer_id == vacancy_id)
    )
    applications = apps_result.scalars().all()

    if not applications:
        return []
    
    candidate_ids = [app.candidate_id for app in applications]

    candidates_result = await db.execute(
        select(Candidate).where(Candidate.id.in_(candidate_ids))
    )
    #  diccionario para buscar al candidato rápido por su ID 
    candidates_dict = {
        c.id: c for c in candidates_result.scalars().all()
    }

    output = []
    for app in applications:
        c = candidates_dict.get(app.candidate_id)
        if not c:
            continue  
            
        output.append({
            "id": app.id, 
            "name": f"{c.first_name} {c.last_name}".strip(),
            "phase": app.status.value if hasattr(app.status, "value") else str(app.status),
            "result": None, 
            "notes": app.feedback or "", 
            "date": app.updated_at or app.created_at
        })

    # orden por fecha
    output.sort(key=lambda x: x["date"], reverse=True)
    
    return output

async def get_vacancy_notes(db: AsyncSession, vacancy_id: int) -> list[dict]:
    
    result = await db.execute(
        select(TrackingHistory)
        .options(joinedload(TrackingHistory.user)) 
        .where(TrackingHistory.offer_id == vacancy_id)
        .order_by(TrackingHistory.recorded_at.desc())
    )
    history_entries = result.scalars().all()

    if not history_entries:
        return []

    output = []
    for entry in history_entries:
        if entry.previous_status and entry.new_status:
            prev = entry.previous_status.value if hasattr(entry.previous_status, "value") else str(entry.previous_status)
            curr = entry.new_status.value if hasattr(entry.new_status, "value") else str(entry.new_status)
            resultado_texto = f"{prev} -> {curr}"
        elif entry.new_status:
            resultado_texto = entry.new_status.value if hasattr(entry.new_status, "value") else str(entry.new_status)
        else:
            resultado_texto = "Sin cambio"

        nombre_usuario = "System"
        if entry.user:

            if entry.user.name:
                    nombre_usuario = entry.user.name

            elif entry.user:
                nombre_usuario = entry.user.email.split("@")[0]

        output.append({
            "id": entry.id,
            "name": nombre_usuario, 
            "phase": entry.action_type or "Actualización",
            "result": resultado_texto,
            "notes": entry.comments or "",
            "date": entry.recorded_at
        })

    return output

async def create_vacancy_note(
    db: AsyncSession, 
    vacancy_id: int, 
    note_data: dict, 
    user_id: int
):
    nueva_nota = TrackingHistory(
        offer_id=vacancy_id,
        user_id=user_id, 
        action_type=note_data.phase,
        comments=note_data.notes,
    )
    
    db.add(nueva_nota)
    await db.commit()
    await db.refresh(nueva_nota)
    
    return nueva_nota

async def update_candidate_tracking(
    db: AsyncSession, 
    vacancy_id: int, 
    data: CandidateTrackingCreate,
) -> bool:
    
    apps_result = await db.execute(
        select(JobApplication).where(JobApplication.offer_id == vacancy_id)
    )
    applications = apps_result.scalars().all()

    if not applications:
        return False

    app_to_update = None
    
    for app in applications:
        cand_result = await db.execute(
            select(Candidate).where(Candidate.id == app.candidate_id)
        )
        candidate = cand_result.scalar_one_or_none()
        
        if candidate:
            full_name = f"{candidate.first_name} {candidate.last_name}".strip()
            if full_name.lower() == data.name.lower(): 
                app_to_update = app
                break
                
    if not app_to_update:
        return False

    app_to_update.status = data.phase
    app_to_update.feedback = data.notes
    
    
    db.add(app_to_update)
    await db.commit()
    
    return True