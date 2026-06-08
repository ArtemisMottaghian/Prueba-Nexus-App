from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from fastapi.responses import FileResponse
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
    CandidatePublicCreate,
    CandidateScraperStatusOut,
    VerifyRequest,
)
from app.schemas.comments_schemas import CommentCreate, CommentUpdate, CommentResponse
from app.services import comments_service
from app.services.llm_parser import parse_with_code

import traceback
import uuid
import io
import pdfplumber
import re
import unicodedata
import os

router = APIRouter()

# 🛠️ Definimos y creamos la carpeta donde se guardarán los PDFs manuales y automáticos
CV_STORAGE_DIR = os.path.join(os.getcwd(), "stored_cvs")
os.makedirs(CV_STORAGE_DIR, exist_ok=True)


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
    """
    Obtiene la lista completa de candidatos.
    Permite filtrar los resultados por ubicación, habilidades, estado, fuente de origen y si han sido verificados.
    Se utiliza principalmente para renderizar la tabla principal de candidatos en el Frontend.
    """
    return await candidates_service.get_all_candidates(db, location, skills, status, source, verified)


@router.get("/search", response_model=List[CandidateFrontendOut])
async def search_candidates(
    name: str = Query(..., min_length=3, description="Nombre o apellido a buscar"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Buscador específico de candidatos por nombre o apellido.
    Requiere un mínimo de 3 caracteres para realizar la búsqueda.
    Ideal para barras de búsqueda rápida en la interfaz.
    """
    candidates = await candidates_service.search_candidates_by_name(db, name)
    if not candidates:
        raise HTTPException(status_code=404, detail="No se encontraron candidatos con ese nombre")
    return candidates


@router.get("/scraper-status", response_model=CandidateScraperStatusOut)
async def get_scraper_status(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Devuelve las estadísticas actuales del motor de scraping.
    Informa sobre cuántos perfiles se han extraído mediante el scraper automático
    para mostrarlo en el panel de control.
    """
    return await candidates_service.get_scraper_status(db)


@router.get("/locations", response_model=List[str])
async def get_candidate_locations(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Extrae una lista única de todas las ubicaciones (ciudades/países) 
    registradas actualmente en la base de datos de candidatos.
    Útil para rellenar los selectores de los filtros en el Frontend.
    """
    return await candidates_service.get_location_options(db)


@router.get("/{candidate_id}", response_model=CandidateFrontendOut)
async def read_candidate(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Obtiene todos los detalles de un candidato específico mediante su ID.
    Se utiliza al hacer clic en un candidato para abrir su vista detallada o perfil.
    """
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
    """
    Crea un candidato manualmente en la base de datos enviando sus datos en formato JSON.
    Se utiliza cuando se rellena un formulario de creación manual en lugar de subir un PDF.
    """
    return await candidates_service.create_candidate(db, payload)


@router.patch("/{candidate_id}", response_model=CandidateOut)
async def update_candidate(
    candidate_id: int,
    payload: CandidateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Actualiza parcialmente los datos de un candidato existente.
    Permite modificar campos como el teléfono, ubicación o experiencia desde su ficha.
    """
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
    """
    Actualiza exclusivamente el estado (status) de un candidato.
    Ejemplo: Cambiarlo de 'active' a 'hired' o 'rejected' en el flujo de selección.
    """
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
    """
    Elimina permanentemente a un candidato de la base de datos.
    """
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
    """
    Marca o desmarca a un candidato como favorito (destacado).
    Se acciona normalmente con un icono de estrella en la interfaz.
    """
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
    """
    Marca a un candidato como 'Verificado' tras comprobar manualmente que sus datos son reales.
    Útil para diferenciar candidatos revisados de los recién extraídos por el scraper.
    """
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
    #current_user: dict = Depends(get_current_user),
):
    """
    Endpoint principal de subida manual de Currículums.
    Realiza tres acciones clave:
    1. Lee el PDF subido desde el Frontend y extrae su texto.
    2. Utiliza reglas de código puro (Regex y Heurística) para extraer Nombre, Email, Experiencia, etc.
    3. Guarda el archivo PDF físicamente en el servidor (/stored_cvs/) y registra al candidato en la BBDD.
    """
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

        candidate_json = await parse_with_code(raw_text)

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

        # Lógica para guardar el archivo físico en la carpeta
        safe_f = re.sub(r'[^a-z0-9]', '', fn_final.lower())
        safe_l = re.sub(r'[^a-z0-9]', '', ln_final.lower())
        unique_id = uuid.uuid4().hex[:8]
        filename = f"{safe_f}_{safe_l}_{unique_id}.pdf"
        file_path = os.path.join(CV_STORAGE_DIR, filename)
        
        try:
            with open(file_path, "wb") as f:
                f.write(file_bytes)
            cv_url_bd = f"/stored_cvs/{filename}"
        except Exception as e:
            print(f"⚠️ Error al guardar el PDF físico: {e}")
            cv_url_bd = None

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
            cv_url=cv_url_bd, 
            status="active",
        )

        new_candidate = await candidates_service.create_candidate(db, candidate_payload)
        return new_candidate

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno procesando el candidato: {str(e)}")


@router.get("/download-cv/{filename}")
async def download_cv(filename: str):
    """
    Endpoint para que el Frontend descargue el PDF original del candidato.
    Recibe el nombre del archivo (ej: carlos_perez_a1b2c3d4.pdf) y devuelve el archivo físico 
    desde la carpeta de almacenamiento seguro del servidor (/stored_cvs/).
    """
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido.")
        
    file_path = os.path.join(CV_STORAGE_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo PDF no existe en el servidor.")
        
    return FileResponse(file_path, media_type="application/pdf")

@router.post("/public", response_model=CandidateOut, status_code=201)
async def create_candidate_public(
    payload: CandidatePublicCreate,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email if payload.email and "@" in payload.email \
        else f"publico.{uuid.uuid4().hex[:8]}@scraping.com"

    phone = payload.phone if payload.phone else "000000000"

    first_name = (payload.first_name or "").strip()
    last_name = (payload.last_name or "").strip()
    if len(first_name) < 2:
        first_name = "Candidato"
    if len(last_name) < 2:
        last_name = first_name

    candidate_data = CandidateCreate(
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        location=payload.location or "España",
        source=payload.source or "Vacante pública",
        experience=str(payload.experience) if payload.experience else None,
        education=payload.education or None,
        skills=payload.specialty or payload.skills or None,
        status=CandidateStatus.active,
    )
    return await candidates_service.create_candidate(db, candidate_data)