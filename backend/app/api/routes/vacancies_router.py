from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.connection import get_db
from app.services import vacancies_service
from app.schemas.vacancies_schemas import (
    VacancySummary,
    VacancyDetail,
    VacancyFiltered,
    FavoritoRequest,
    AccionMasivaRequest,
    MensajeResponse
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
    vacantes = await vacancies_service.get_vacancies_list(db, status)
    return vacantes


# -----------------
# Obtener detalle de vacante
# GET /api/vacancies/{vacancy_id}
# -----------------
@router.get("/{vacancy_id}", response_model=VacancyDetail)
async def read_vacancy(
    vacancy_id: int,
    db: AsyncSession = Depends(get_db)
):
    vacante = await vacancies_service.get_vacancy_by_id(db, vacancy_id)

    if vacante is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    return vacante


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
    vacantes = await vacancies_service.get_vacantes_filtradas(db, status, sector, location)
    return vacantes


# -----------------
# Marcar vacante como favorita
# PATCH /api/vacantes/{vacancy_id}/favorito
# -----------------
@router.patch("/{vacancy_id}/favorite", response_model=MensajeResponse)
async def marck_favorite(
    vacancy_id: int,
    body: FavoritoRequest,
    db: AsyncSession = Depends(get_db)
):
    vacante = await vacancies_service.get_vacancy_by_id(db, vacancy_id)

    if vacante is None:
        raise HTTPException(status_code=404, detail="La vacante no existe")

    await vacancies_service.set_favorito(db, vacancy_id, body.favorito)
    return {"mensaje": f"Vacante {'marcada' if body.favorito else 'desmarcada'} como favorita"}


# -----------------
# Acciones masivas sobre vacantes (cambiar estado o eliminar)
# POST /api/vacantes/acciones-masivas
# -----------------
@router.post("/bulk-actions", response_model=MensajeResponse)
async def bulk_actions(
    body: AccionMasivaRequest,
    db: AsyncSession = Depends(get_db)
):
    if body.accion not in ("descartar", "eliminar"):
        raise HTTPException(
            status_code=400,
            detail="Acción no válida. Usa 'descartar' o 'eliminar'"
        )

    await vacancies_service.apply_bulk_action(db, body.ids_vacantes, body.accion)
    return {"mensaje": f"Acción '{body.accion}' aplicada a {len(body.ids_vacantes)} vacantes"}