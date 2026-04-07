from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.connection import get_db
from app.services import candidates_service
from app.schemas.candidates_schemas import (
    CandidateFrontendOut,
    CandidateStatusUpdate,
    CandidateStatusOut,
    CandidateCreate,
    CandidateUpdate,
    CandidateOut,
    MessageResponse
)

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
# CREAR candidato
# POST /api/candidates
# --------------------

@router.post("", response_model=CandidateOut, status_code=201)
async def create_candidate(
    payload: CandidateCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea un nuevo candidato."""
    return await candidates_service.create_candidate(db, payload)

# --------------------
# ACTUALIZAR candidato
# PATCH /api/candidates/{candidate_id}
# --------------------

@router.patch("/{candidate_id}", response_model=CandidateOut)
async def update_candidate(
    candidate_id: int,
    payload: CandidateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza los datos de un candidato."""
    candidate = await candidates_service.update_candidate(db, candidate_id, payload)
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
    
    return candidate

# --------------------
# ELIMINAR candidato 
# DELETE /api/candidates/{candidate_id}
# --------------------

@router.delete("/{candidate_id}", response_model=MessageResponse)
async def delete_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Elimina un candidato del sistema."""
    success = await candidates_service.delete_candidate(db, candidate_id)
    if not success:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
        
    return {"message": "Candidato eliminado correctamente"}