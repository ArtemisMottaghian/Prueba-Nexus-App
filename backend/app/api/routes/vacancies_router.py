from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.connection import get_db
from app.services import vacancies_service
from app.schemas.vacancies_schemas import (
    VacancySummary,
    VacancyDetail,
    VacancyFiltered,
    FavoriteRequest,
    BulkActionRequest,
    MessageResponse
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
# GET /api/vacantes?estado=Nueva&sector=Tecnologia&ubicacion=Madrid
# -----------------
@router.get("/filter/list", response_model=List[VacancyFiltered])
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
# PATCH /api/vacantes/{vacancy_id}/favorito
# -----------------
@router.patch("/{vacancy_id}/favorite", response_model=MessageResponse)
async def marck_favorite(
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
# POST /api/vacantes/acciones-masivas
# -----------------
@router.post("/bulk-actions", response_model=MessageResponse)
async def bulk_actions(
    body: BulkActionRequest,
    db: AsyncSession = Depends(get_db)
):
    if body.action not in ("discard", "delete"):
        raise HTTPException(
            status_code=400,
            detail="Acción no válida. Usa 'discard' o 'delete'"
        )

    await vacancies_service.apply_bulk_action(db, body.vacancy_ids, body.action)
    return {"message": f"Acción '{body.action}' aplicada a {len(body.vacancy_ids)} vacantes"}