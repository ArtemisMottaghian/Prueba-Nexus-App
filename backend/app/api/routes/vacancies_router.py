import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.services.orchestrator_vacancies import run_scrapers
from app.db.connection import get_db
from app.services import vacancies_service
from app.schemas.vacancies_schemas import (
    CandidateTrackingCreate,
    CandidateTrackingOut,
    VacancyAssignmentRequest,
    VacancyNoteCreate,
    VacancyNoteOut,
    VacancySummary,
    VacancyDetail,
    VacancyFiltered,
    FavouriteRequest,
    BulkActionRequest,
    MessageResponse,
    StatusRequest, 
    CandidateMatchOut
)
from app.core.jwt import get_current_user
from app.models.user_model import User, UserRole
from app.models.job_model import JobApplication
from app.models.aplication_model import ApplicationStatus
from sqlalchemy.exc import IntegrityError

router = APIRouter()


# -----------------
# Obtener listado de vacantes
# GET /api/vacancies
# -----------------
@router.get("", response_model=List[VacancySummary])
async def read_vacancies(
    status: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    vacancies = await vacancies_service.get_vacancies_list(db, status)
    return vacancies


# -----------------
# Listado filtrado de vacantes (estado, sector, ubicación)
# GET /api/vacancies?status=new&sector=Tecnologia&location=Madrid
# -----------------
@router.get("/filter/list", response_model=List[VacancyFiltered])
async def read_vacancies_filtered(
    status: Optional[str] = None,
    sector: Optional[str] = None,
    location: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    vacancies = await vacancies_service.get_vacancies_filtered(
        db, status, sector, location
    )
    return vacancies

# -----------------
# Obtener la localizacion de las vacantes
# GET /api/vacancies/locations
# -----------------
@router.get("/locations", response_model=List[str])
async def read_locations(db: AsyncSession = Depends(get_db)):
    return await vacancies_service.get_distinct_locations(db)

# -----------------
# Obtener candidates para una vacante
# GET /api/vacancies/{vacancy_id}/candidates
# -----------------
@router.get("/{vacancy_id}/candidates", response_model=List[CandidateMatchOut])
async def read_suitable_candidates(vacancy_id: int, db: AsyncSession = Depends(get_db)):
    candidates = await vacancies_service.get_suitable_candidates(db, vacancy_id)
    if candidates is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")
    return candidates

# -----------------
# Obtener detalle de vacante
# GET /api/vacancies/{vacancy_id}
# -----------------
@router.get("/{vacancy_id}", response_model=VacancyDetail)
async def read_vacancy(vacancy_id: int, db: AsyncSession = Depends(get_db)):
    vacancy = await vacancies_service.get_vacancy_detail(db, vacancy_id)

    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    return vacancy


# -----------------
# Marcar vacante como favorita
# PATCH /api/vacancies/{vacancy_id}/favorito
# -----------------
@router.patch("/{vacancy_id}/favourite", response_model=MessageResponse)
async def mark_favorite(
    vacancy_id: int, body: FavouriteRequest, db: AsyncSession = Depends(get_db)
):
    vacancy = await vacancies_service.get_vacancy_by_id(db, vacancy_id)

    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    await vacancies_service.set_favourite(db, vacancy_id, body.favourite)
    return {
        "message": f"Vacante {'marcada' if body.favourite else 'desmarcada'} como favorita"
    }


# -----------------
# Actualizar estado de una vacante
# PATCH /api/vacancies/{vacancy_id}/status
# -----------------
@router.patch("/{vacancy_id}/status", response_model=MessageResponse)
async def update_vacancy_status(
    vacancy_id: int, body: StatusRequest, db: AsyncSession = Depends(get_db)
):
    vacancy = await vacancies_service.get_vacancy_by_id(db, vacancy_id)
    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    updated = await vacancies_service.update_vacancy_status(db, vacancy_id, body.status)
    if not updated:
        raise HTTPException(status_code=400, detail="No se pudo actualizar el estado")

    return {"message": f"Estado actualizado a '{body.status}'"}



# -----------------
# Acciones masivas sobre vacantes (cambiar estado o eliminar)
# POST /api/vacancies/bulk-actions
# -----------------
@router.post("/bulk-actions", response_model=MessageResponse)
async def bulk_actions(body: BulkActionRequest, db: AsyncSession = Depends(get_db)):

    await vacancies_service.apply_bulk_action(db, body.vacancy_ids, body.action)
    return {
        "message": f"Acción '{body.action}' aplicada a {len(body.vacancy_ids)} vacantes"
    }


# -----------------
# Lanzar scraper manualmente
# POST /api/vacancies/trigger-scraper
# -----------------
@router.post("/trigger-scraper", response_model=MessageResponse)
async def trigger_scraper():
    """Lanza el orquestador manualmente para buscar nuevas vacantes."""
    asyncio.create_task(run_scrapers())
    return {
        "message": "Scraper lanzado correctamente, las vacantes se actualizarán en breve"
    }


# -----------------
# Asignar vacantes de manera multiple
# POST /api/vacancies/assign-to-hr
# -----------------
@router.post("/assign-hr", response_model=MessageResponse)
async def assign_hr_to_vacancies(
    body: VacancyAssignmentRequest, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    #control de permisos (admins y company)
    user_role = current_user.get("role")
    
    if user_role not in [UserRole.admin.value, UserRole.company.value]:
        raise HTTPException(
            status_code=403, 
            detail="No tienes permisos para asignar vacantes."
        )
    
    assgined_count = await vacancies_service.assign_hr_to_vacancies(
        db, body.hr_id, body.vacancy_ids
    )

    return {
        "message": f"Se han asignado {assgined_count} vacantes al gestor de RRHH correctamente"
    }

# -----------------
# Obtener vacantes asignadas a un HR específico
# GET /api/vacancies/assigned/{hr_id}
# -----------------
@router.get("/assigned/{hr_id}", response_model=List[VacancySummary])
async def read_vacancies_by_hr(hr_id: int, db: AsyncSession = Depends(get_db)):
    """Devuelve las ofertas gestionadas por un reclutador concreto."""
    vacancies = await vacancies_service.get_vacancies_by_hr(db, hr_id)

    return vacancies


# -----------------
# Quitar asignación de HR a vacantes
# DELETE /api/vacancies/assign-hr/{hr_id}/{vacancy_ids_str}
# -----------------
@router.delete("/unassign-hr/{hr_id}/{vacancy_ids_str}")
async def unassign_hr_from_vacancies(
    hr_id: int,
    vacancy_ids_str: str, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        vacancy_ids = [int(vid) for vid in vacancy_ids_str.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de IDs de vacante inválido")

    user_role = current_user.get("role")
    user_id = current_user.get("id")

    is_admin = user_role == UserRole.admin
    is_company = user_role == UserRole.company
    
    if not is_admin and not is_company and user_id != hr_id:
        raise HTTPException(
            status_code=403, 
            detail="No tienes permisos para esta acción."
        )

    unassigned_count = await vacancies_service.remove_hr_assignment(
        db, hr_id, vacancy_ids, is_admin=(is_admin or is_company)
    )

    return {
        "message": f"Acción realizada: se han liberado {unassigned_count} vacantes."
    }

# -----------------
# URL pública de vacante (sin login, sin indexación de buscadores)
# GET /api/vacancies/public/{vacancy_id}
# -----------------
@router.get("/public/{vacancy_id}", response_model=VacancyDetail)
async def read_vacancy_public(vacancy_id: int, db: AsyncSession = Depends(get_db), response: Response = None):
    vacancy = await vacancies_service.get_vacancy_detail(db, vacancy_id)
    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return vacancy

# -----------------
# OBTENER SEGUIMIENTO DE CANDIDATOS POR VACANTE
# GET /api/vacancies/{id}/candidate-tracking
# -----------------
@router.get("/{id}/candidate-tracking", response_model=List[CandidateTrackingOut])
async def read_vacancy_candidate_tracking(id: int, db: AsyncSession = Depends(get_db)):
    tracking_data = await vacancies_service.get_candidate_tracking(db, id)
    
    if tracking_data is None:
        raise HTTPException(status_code=404, detail="No se ha encontrado seguimiento para esta vacante")
        
    return tracking_data


# -----------------
# OBTENER NOTAS DE VACANTE (Historial de seguimiento)
# GET /api/vacancies/{id}/notes
# -----------------
@router.get("/{id}/notes", response_model=List[VacancyNoteOut])
async def read_vacancy_notes(id: int, db: AsyncSession = Depends(get_db)):
    notes = await vacancies_service.get_vacancy_notes(db, id)
    
    if notes is None:
        return [] 
        
    return notes

# -----------------------------------------------------------
# GUARDAR NOTA EN VACANTE
# POST /api/vacancies/{id}/notes
# -----------------------------------------------------------
@router.post("/{id}/notes")
async def create_vacancy_note(
    id: int, 
    note_data: VacancyNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):
    user_id = current_user.get("id")

    new_note = await vacancies_service.create_vacancy_note(db, id, note_data, user_id)
    return {"message": "Nota guardada correctamente", "note_id": new_note.id}


# -----------------------------------------------------------
# GUARDAR SEGUIMIENTO DE CANDIDATO POR VACANTE
# POST /api/vacancies/{id}/candidate-tracking
# -----------------------------------------------------------
@router.post("/{id}/candidate-tracking")
async def create_candidate_tracking(
    id: int,
    tracking_data: CandidateTrackingCreate,
    db: AsyncSession = Depends(get_db)
):
    success = await vacancies_service.update_candidate_tracking(db, id, tracking_data)
    
    if not success:
        raise HTTPException(
            status_code=404, 
            detail=f"No se ha encontrado al candidato '{tracking_data.nombre}' en esta vacante."
        )
        
    return {"message": "Seguimiento del candidato actualizado correctamente"}

# -----------------
# Actualizar datos de una vacante
# PATCH /api/vacancies/{vacancy_id}
# -----------------
@router.patch("/{vacancy_id}", response_model=MessageResponse)
async def update_vacancy(
    vacancy_id: int, body: StatusRequest, db: AsyncSession = Depends(get_db)
):
    vacancy = await vacancies_service.get_vacancy_by_id(db, vacancy_id)
    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    updated = await vacancies_service.update_vacancy_status(db, vacancy_id, body.status)
    if not updated:
        raise HTTPException(status_code=400, detail="No se pudo actualizar la vacante")

    return {"message": "Vacante actualizada correctamente"}

# -----------------------------------------------------------
# EDITAR NOTA DE VACANTE
# PATCH /api/vacancies/{id}/notes/{note_id}
# -----------------------------------------------------------
@router.patch("/{id}/notes/{note_id}", response_model=MessageResponse)
async def update_vacancy_note(
    id: int,
    note_id: int,
    note_data: VacancyNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated = await vacancies_service.update_vacancy_note(db, note_id, note_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return {"message": "Nota actualizada correctamente"}

# -----------------------------------------------------------
# CREAR APLICACIÓN DE CANDIDATO A VACANTE
# POST /api/vacancies/{vacancy_id}/applications
# -----------------------------------------------------------
@router.post("/{vacancy_id}/applications", response_model=MessageResponse)
async def create_application(
    vacancy_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db)
):


    candidate_id = body.get("candidate_id")
    if not candidate_id:
        raise HTTPException(status_code=400, detail="candidate_id es obligatorio")

    try:
        new_app = JobApplication(
            candidate_id=candidate_id,
            offer_id=vacancy_id,
            status=ApplicationStatus.proposed
        )
        db.add(new_app)
        await db.commit()
        return {"message": "Candidato añadido al seguimiento correctamente"}
    except IntegrityError:
        await db.rollback()
        return {"message": "El candidato ya está en seguimiento para esta vacante"}





# -----------------------------------------------------------
# ELIMINAR NOTA DE VACANTE
# DELETE /api/vacancies/{id}/notes/{note_id}
# -----------------------------------------------------------
@router.delete("/{id}/notes/{note_id}", response_model=MessageResponse)
async def delete_vacancy_note(
    id: int,
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deleted = await vacancies_service.delete_vacancy_note(db, note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return {"message": "Nota eliminada correctamente"}