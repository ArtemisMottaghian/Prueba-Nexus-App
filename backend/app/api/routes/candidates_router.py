from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List,Optional

from app.db.connection import get_db
from app.services import candidates_service
from app.schemas.candidates_schemas import (
    CandidateFrontendOut,
    CandidateStatus,
    CandidateStatusUpdate,
    CandidateStatusOut,
    CandidateCreate,
    CandidateUpdate,
    CandidateOut,
    MessageResponse,
    FavouriteRequest,
    CandidateScraperStatusOut,
    VerifyRequest,
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
    status: Optional[CandidateStatus] = None,
    source: Optional[str] = None,
    verified: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    return await candidates_service.get_all_candidates(db, location, skills, status, source,verified)

#busqueda por nombre o apellido
@router.get("/search", response_model=List[CandidateFrontendOut])
async def search_candidates(
    name: str = Query(..., min_length=3, description="Nombre o apellido a buscar"),
    db: AsyncSession = Depends(get_db)
):
    candidates = await candidates_service.search_candidates_by_name(db, name)

    #  devuelve un 404 cuando no hay resultados
    if not candidates:
        raise HTTPException(status_code=404, detail="No se encontraron candidatos con ese nombre")

    return candidates

# -----------------
# Estado de los scrapers de candidatos
# GET /api/candidates/scraper-status
# -----------------
@router.get("/scraper-status", response_model=CandidateScraperStatusOut)
async def get_scraper_status(db: AsyncSession = Depends(get_db)):
    """Devuelve el estado de cada scraper de candidatos."""
    return await candidates_service.get_scraper_status(db)


# --------------------
# UBICACIONES para filtro
# GET /api/candidates/locations
# --------------------

@router.get("/locations", response_model=List[str])
async def get_location_options(db: AsyncSession = Depends(get_db)):
    """Lista de ciudades únicas normalizadas para el filtro del frontend."""
    return await candidates_service.get_location_options(db)





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
# PATCH /api/candidates/{candidate_id}/favourite
# -----------------
@router.patch("/{candidate_id}/favourite", response_model=MessageResponse)
async def mark_u(
    candidate_id: int, body: FavouriteRequest, db: AsyncSession = Depends(get_db)
):
    candidate = await candidates_service.get_candidate_by_id(db, candidate_id)

    if candidate is None:
        raise HTTPException(status_code=404, detail="El candidato no existe")

    await candidates_service.set_favourite(db, candidate_id, body.favourite)
    return {
        "message": f"Candidato {'marcado' if body.favourite else 'desmarcado'} como favorito"
    }

# -----------------
# Verificar candidato
# PATCH /api/candidates/{candidate_id}/verify
# -----------------
@router.patch("/{candidate_id}/verify", response_model=MessageResponse)
async def verify_candidate(
    candidate_id: int, body: VerifyRequest, db: AsyncSession = Depends(get_db)
):
    candidate = await candidates_service.get_candidate_by_id(db, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="El candidato no existe")

    await candidates_service.set_verified(db, candidate_id, body.verified)
    return {
        "message": f"Candidato {'verificado' if body.verified else 'desverificado'} correctamente"
    }