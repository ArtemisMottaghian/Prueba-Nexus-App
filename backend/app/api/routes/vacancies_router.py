from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.schemas.job_offer import JobOfferBase

from app.db.connection import get_db
from app.services import vacancies_service
from app.schemas.vacancies_schemas import VacancySummary, VacancyDetail

router = APIRouter()

# Listado vacantes con filtro opcional por estado
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

# Detalle de vacante por ID
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