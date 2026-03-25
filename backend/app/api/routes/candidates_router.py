from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.connection import get_db
from app.services import candidates_service
from app.schemas.candidates_schemas import CandidateFrontendOut, CandidateStatusUpdate, CandidateStatusOut

router = APIRouter()

# --------------------
# obtener candidatoS 
# GET /api/candidates
# --------------------

@router.get("", response_model=List[CandidateFrontendOut])
async def read_candidates(db: AsyncSession = Depends(get_db)):
    return await candidates_service.get_all_candidates(db)

# --------------------
# obtener candidato 
# GET /api/candidates/{candidate_id}
# --------------------

@router.get("/{candidate_id}", response_model=CandidateFrontendOut)
async def read_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene un candidato específico por ID."""
    candidate = await candidates_service.get_candidate_by_id(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    return candidate

# --------------------
# ACTUALIZAR ESTATUS candidato 
# PATCH /api/candidates/{candidate_id}/status
# --------------------

@router.patch("/{candidate_id}/status", response_model=CandidateStatusOut)
async def update_candidate_status(
    candidate_id: int, 
    payload: CandidateStatusUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Actualiza únicamente el estado de un candidato."""
    candidate = await candidates_service.update_status(db, candidate_id, payload.status)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    
    return {"id": candidate.id, "status": candidate.status.value}

# --------------------
# ELIMINAR candidato 
# DELETE /api/candidates/{candidate_id}
# --------------------

@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Elimina un candidato del sistema."""
    success = await candidates_service.delete_candidate(db, candidate_id)
    if not success:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
        
    return {"message": "Candidato eliminado correctamente"}