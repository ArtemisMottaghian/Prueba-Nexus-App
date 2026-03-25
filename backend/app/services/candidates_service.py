from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException

from app.models.candidates_model import Candidate
from app.schemas.candidates_schemas import CandidateUpdate


async def update_candidate(db: AsyncSession, candidate_id: int, candidate_data: CandidateUpdate) -> Candidate:
    try:
        result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
        candidate = result.scalars().first()

        if not candidate:
            raise HTTPException(
                status_code=404,
                detail=f"Candidato con ID {candidate_id} no encontrado"
            )
        
        update_data = candidate_data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(candidate, key, value)

        await db.commit()
        await db.refresh(candidate)

        return candidate
    
    except HTTPException:
        raise

    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error de SQLAlchemy al actualizar el candidato: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error interno al procesar la actualizacion en la base de datos"
        )
    
    except Exception as e:
        await db.rollback()
        print(f"Error inesperado al actualizar el candidato: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error inesperado en el servidor"
        )