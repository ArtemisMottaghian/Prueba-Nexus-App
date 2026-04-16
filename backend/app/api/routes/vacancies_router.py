import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.services.orchestrator import run_scrapers
from app.db.connection import get_db
from app.services import vacancies_service
from app.schemas.vacancies_schemas import (
    VacancySummary,
    VacancyDetail,
    VacancyFiltered,
    FavoriteRequest,
    BulkActionRequest,
    MessageResponse,
    StatusRequest
)

router = APIRouter()

# -----------------
# Obtener listado de vacantes
# GET /api/vacancies
# -----------------
@router.get("", response_model=List[VacancySummary])
async def read_vacancies(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    vacancies = await vacancies_service.get_vacancies_list(db, status)
    return vacancies

# -----------------
# Listado filtrado de vacantes (estado, sector, ubicación)
# GET /api/vacancies?status=new&sector=Tecnologia&location=Madrid
# -----------------
@router.get("/filter/list",response_model=List[VacancyFiltered])
async def read_vacancies_filtered(
    status: Optional[str] = None,
    sector: Optional[str] = None,
    location: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    vacancies = await vacancies_service.get_vacancies_filtered(db, status, sector, location)
    return vacancies


# -----------------
# Obtener detalle de vacante
# GET /api/vacancies/{vacancy_id}
# -----------------
@router.get("/{vacancy_id}", response_model=VacancyDetail)
async def read_vacancy(
    vacancy_id: int,
    db: AsyncSession = Depends(get_db)
):
    vacancy = await vacancies_service.get_vacancy_by_id(db, vacancy_id)

    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    return vacancy




# -----------------
# Marcar vacante como favorita
# PATCH /api/vacancies/{vacancy_id}/favorito
# -----------------
@router.patch("/{vacancy_id}/favorite", response_model=MessageResponse)
async def mark_favorite(
    vacancy_id: int,
    body: FavoriteRequest,
    db: AsyncSession = Depends(get_db)
):
    vacancy = await vacancies_service.get_vacancy_by_id(db, vacancy_id)

    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    await vacancies_service.set_favorite(db, vacancy_id, body.favorite)
    return {"message": f"Vacante {'marcada' if body.favorite else 'desmarcada'} como favorita"}


# -----------------
# Acciones masivas sobre vacantes (cambiar estado o eliminar)
# POST /api/vacancies/bulk-actions
# -----------------
@router.post("/bulk-actions", response_model=MessageResponse)
async def bulk_actions(
    body: BulkActionRequest,
    db: AsyncSession = Depends(get_db)
):

    await vacancies_service.apply_bulk_action(db, body.vacancy_ids, body.action)
    return {"message": f"Acción '{body.action}' aplicada a {len(body.vacancy_ids)} vacantes"}

# -----------------
# Lanzar scraper manualmente
# POST /api/vacancies/trigger-scraper
# -----------------
@router.post("/trigger-scraper", response_model=MessageResponse)
async def trigger_scraper():
    """Lanza el orquestador manualmente para buscar nuevas vacantes."""
    asyncio.create_task(run_scrapers())
    return {"message": "Scraper lanzado correctamente, las vacantes se actualizarán en breve"}

# -----------------
# Cambiar estado de una vacante
# PATCH /api/vacancies/{vacancy_id}/status
# -----------------
@router.patch("/{vacancy_id}/status", response_model=MessageResponse)
async def update_status(
    vacancy_id: int,
    body: StatusRequest,
    db: AsyncSession = Depends(get_db)
):
    vacancy = await vacancies_service.get_vacancy_by_id(db, vacancy_id)

    if vacancy is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    await vacancies_service.update_vacancy_status(db, vacancy_id, body.status)
    return {"message": f"Estado actualizado a '{body.status}'"}