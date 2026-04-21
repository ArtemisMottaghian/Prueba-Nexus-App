from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List,Optional

from app.db.connection import get_db
from app.services import candidates_service
from app.schemas.candidates_schemas import (
    CandidateFrontendOut,
    CandidateStatusUpdate,
    CandidateStatusOut,
    CandidateCreate,
    CandidateUpdate,
    CandidateOut,
    MessageResponse,
    FavoriteRequest,
    CandidateScraperStatusOut,
)
from app.schemas.comments_schemas import CommentCreate, CommentUpdate, CommentResponse
from app.services import comments_service

router = APIRouter()

# --------------------
# obtener candidatoS
# GET /api/candidates
# --------------------

@router.get("", response_model=List[CandidateFrontendOut])
async def read_candidates(
    location: Optional[str] = None,
    skills: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    return await candidates_service.get_all_candidates(db, location, skills, status, source)

# -----------------
# Estado de los scrapers de candidatos
# GET /api/candidates/scraper-status
# -----------------
@router.get("/scraper-status", response_model=CandidateScraperStatusOut)
async def get_scraper_status(db: AsyncSession = Depends(get_db)):
    """Devuelve el estado de cada scraper de candidatos."""
    return await candidates_service.get_scraper_status(db)

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


# -----------------
# Marcar candidato como favorito
# PATCH /api/candidates/{candidate_id}/favorite
# -----------------
@router.patch("/{candidate_id}/favorite", response_model=MessageResponse)
async def mark_favorite(
    candidate_id: int, body: FavoriteRequest, db: AsyncSession = Depends(get_db)
):
    candidate = await candidates_service.get_candidate_by_id(db, candidate_id)

    if candidate is None:
        raise HTTPException(status_code=404, detail="El candidato no existe")

    await candidates_service.set_favorite(db, candidate_id, body.favorite)
    return {
        "message": f"Candidato {'marcado' if body.favorite else 'desmarcado'} como favorito"
    }

# Añadir nota a candidato
@router.post("/{candidate_id}/comments", response_model=CommentResponse)
async def create_candidate_note(
    candidate_id: int,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        return await comments_service.add_candidate_comment(db, candidate_id, body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Modificar nota de candidato
@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def modify_candidate_note(
    comment_id: int,
    body: CommentUpdate,
    db: AsyncSession = Depends(get_db)
):
    updated_comment = await comments_service.update_candidate_comment(db, comment_id, body.comment)
    if not updated_comment:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return updated_comment

#obtener notas de candidato
@router.get("/{candidate_id}/comments", response_model=List[CommentResponse])
async def read_candidate_notes(
    candidate_id: int,
    db: AsyncSession = Depends(get_db)
):
    comentarios = await comments_service.get_candidate_comments(db, candidate_id)
    return comentarios

