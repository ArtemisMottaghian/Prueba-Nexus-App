from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.connection import get_db
from app.services import ai_service
from app.schemas.ai_schemas import MatchResult

router = APIRouter()


@router.post("/match-vacancy/{vacancy_id}", response_model=MatchResult)
async def match_vacancy_endpoint(vacancy_id: int, db: AsyncSession = Depends(get_db)):
    """
    Calcula los 3 candidatos más compatibles para una vacante utilizando IA.
    Retorna un error 404 si la vacante no existe en la base de datos.
    """
    result = await ai_service.calculate_vacancy_match(db, vacancy_id)

    if result is None:
        raise HTTPException(status_code=404, detail="Vacancy not found in the database")

    return result
