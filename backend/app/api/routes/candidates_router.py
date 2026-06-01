from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.connection import get_db
from app.core.jwt import get_current_user
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
    FavoriteRequest,
    CandidateScraperStatusOut,
    VerifyRequest,
)
from app.schemas.comments_schemas import CommentCreate, CommentUpdate, CommentResponse
from app.services import comments_service
from app.services.llm_parser import parse_with_gemini

import traceback
import uuid
import io
import pdfplumber
import re
import unicodedata

router = APIRouter()


@router.get("", response_model=List[CandidateFrontendOut])
async def read_candidates(
    location: Optional[str] = None,
    skills: Optional[str] = None,
    status: Optional[CandidateStatus] = None,
    source: Optional[str] = None,
    verified: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await candidates_service.get_all_candidates(db, location, skills, status, source, verified)


@router.get("/search", response_model=List[CandidateFrontendOut])
async def search_candidates(
    name: str = Query(..., min_length=3, description="Nombre o apellido a buscar"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    candidates = await candidates_service.search_candidates_by_name(db, name)
    if not candidates:
        raise HTTPException(status_code=404, detail="No se encontraron candidatos con ese nombre")
    return candidates


@router.get("/scraper-status", response_model=CandidateScraperStatusOut)
async def get_scraper_status(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await candidates_service.get_scraper_status(db)


@router.get("/locations", response_model=List[str])
async def get_candidate_locations(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await candidates_service.get_location_options(db)


@router.get("/{candidate_id}", response_model=CandidateFrontendOut)
async def read_candidate(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    candidate = await candidates_service.get_candidate_by_id(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    return candidate


@router.post("", response_model=CandidateOut, status_code=201)
async def create_candidate(
    payload: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await candidates_service.create_candidate(db, payload)


@router.patch("/{candidate_id}", response_model=CandidateOut)
async def update_candidate(
    candidate_id: int,
    payload: CandidateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    candidate = await candidates_service.update_candidate(db, candidate_id, payload)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    return candidate


@router.patch("/{candidate_id}/status", response_model=CandidateStatusOut)
async def update_candidate_status(
    candidate_id: int,
    payload: CandidateStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    candidate = await candidates_service.update_status(db, candidate_id, payload.status)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    return candidate


@router.delete("/{candidate_id}", response_model=MessageResponse)
async def delete_candidate(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    success = await candidates_service.delete_candidate(db, candidate_id)
    if not success:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    return {"message": "Candidato eliminado correctamente"}


@router.patch("/{candidate_id}/favorite", response_model=MessageResponse)
async def mark_favorite(
    candidate_id: int,
    body: FavoriteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    candidate = await candidates_service.get_candidate_by_id(db, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="El candidato no existe")
    await candidates_service.set_favorite(db, candidate_id, body.favorite)
    return {
        "message": f"Candidato {'marcado' if body.favorite else 'desmarcado'} como favorito"
    }


@router.patch("/{candidate_id}/verify", response_model=MessageResponse)
async def verify_candidate(
    candidate_id: int,
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    candidate = await candidates_service.get_candidate_by_id(db, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="El candidato no existe")
    await candidates_service.set_verified(db, candidate_id, body.verified)
    return {
        "message": f"Candidato {'verificado' if body.verified else 'desverificado'} correctamente"
    }


@router.post("/process_cv", response_model=CandidateOut, status_code=201)
async def process_cv(
    pdf_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Procesa un candidato subiendo su CV en PDF y se guarda en la BD"""
    if not pdf_file:
        raise HTTPException(status_code=400, detail="Debes subir un archivo PDF con el CV.")

    try:
        raw_text = ""

        if not pdf_file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="El archivo debe ser un PDF válido.")

        file_bytes = await pdf_file.read()

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            raw_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])

        if not raw_text or not raw_text.strip():
            raise HTTPException(status_code=400, detail="No se pudo extraer el texto del documento PDF.")

        candidate_json = await parse_with_gemini(raw_text)

        email_extraido = candidate_json.get("email", "")
        if not email_extraido or "@" not in email_extraido:
            fn = str(candidate_json.get("first_name", "candidato")).lower().replace(" ", "")
            ln = str(candidate_json.get("last_name", "desconocido")).lower().replace(" ", "")

            fn = unicodedata.normalize('NFKD', fn).encode('ascii', 'ignore').decode('utf-8')
            ln = unicodedata.normalize('NFKD', ln).encode('ascii', 'ignore').decode('utf-8')

            fn_clean = re.sub(r'[^a-z0-9]', '', fn)
            ln_clean = re.sub(r'[^a-z0-9]', '', ln)

            if not fn_clean:
                fn_clean = "candidato"
            if not ln_clean:
                ln_clean = "desconocido"

            codigo_unico = uuid.uuid4().hex[:5]
            email_extraido = f"{fn_clean}.{ln_clean}.{codigo_unico}@scraping.com"

        phone_extraido = candidate_json.get("phone", "")
        if not phone_extraido or len(str(phone_extraido)) < 7:
            phone_extraido = "000000000"

        fn_final = str(candidate_json.get("first_name", "")).strip()
        if len(fn_final) < 2:
            fn_final = "Candidato"

        ln_final = str(candidate_json.get("last_name", "")).strip()
        if len(ln_final) < 2:
            ln_final = "Desconocido"

        candidate_payload = CandidateCreate(
            first_name=fn_final,
            last_name=ln_final,
            email=email_extraido,
            phone=phone_extraido,
            location=candidate_json.get("location", "España"),
            source="Inbound (PDF)",
            experience=candidate_json.get("experience", ""),
            education=candidate_json.get("education", ""),
            skills=candidate_json.get("skills", ""),
            candidate_url=None,
            status="active",
        )

        new_candidate = await candidates_service.create_candidate(db, candidate_payload)
        return new_candidate

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno procesando el candidato: {str(e)}")
