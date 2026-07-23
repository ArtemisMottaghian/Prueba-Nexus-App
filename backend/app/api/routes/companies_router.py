import os
import uuid

from sqlalchemy import select, func

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.connection import get_db
from app.services import companies_service
from app.schemas.companies_schemas import (
    CompanyAssignRequest,
    CompanyResponse,
    CompanyCreate,
    CompanyUpdate,
    CompanyWithManagerResponse,
    CompanyDocumentOut,
    CompanyInteractionCreate,
    CompanyInteractionOut,
)
from app.schemas.comments_schemas import CommentCreate, CommentUpdate, CommentResponse
from app.services import comments_service
from app.schemas.users_schemas import MessageResponse
from app.models.companies_model import Company, CompanyDocument
from app.models.job_model import JobOffer
from app.models.trakingHistory_model import TrackingHistory
from app.models.user_model import User
from app.core.jwt import get_current_user

router = APIRouter()

# Carpeta donde se guardan los documentos de empresas (contratos, etc.)
COMPANY_DOCS_DIR = os.path.join(os.getcwd(), "stored_company_docs")
os.makedirs(COMPANY_DOCS_DIR, exist_ok=True)


# -----------------
# Listar todas las empresas
# GET /api/companies
# -----------------
@router.get("", response_model=List[CompanyResponse])
async def list_companies(db: AsyncSession = Depends(get_db)):
    try:
        return await companies_service.get_all_companies(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# -----------------
# Obtener empresas que son clientes
# GET /api/companies/clientes
# -----------------
@router.get("/clientes")
async def get_clientes(
    entity_type: Optional[str] = "confirmed_client",
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene la lista de clientes. Por defecto, solo devuelve los que son 'confirmed_client'.
    """
    query = select(Company)

    # entity_type="all" (o vacío) devuelve todas las empresas (clientes + pendientes)
    if entity_type and entity_type != "all":
        query = query.where(Company.entity_type == entity_type)

    query = query.order_by(Company.created_at.desc())

    result = await db.execute(query)
    clients = result.scalars().all()

    # Contamos las ofertas (vacantes) por empresa para mostrar el número real
    counts_result = await db.execute(
        select(JobOffer.company_id, func.count(JobOffer.id)).group_by(
            JobOffer.company_id
        )
    )
    counts = {cid: total for cid, total in counts_result.all()}

    return [
        {
            "id": c.id,
            "name": c.name,
            "sector": c.sector,
            "primary_contact": c.primary_contact,
            "email": c.email,
            "phone": c.phone,
            "cif": c.cif,
            "address": c.address,
            "website": c.website,
            "linkedin_url": c.linkedin_url,
            "company_description": c.company_description,
            "lead_status": (
                c.lead_status.value
                if hasattr(c.lead_status, "value")
                else c.lead_status
            ),
            "entity_type": c.entity_type,
            "created_at": c.created_at,
            "open_positions": counts.get(c.id, 0),
        }
        for c in clients
    ]


# -----------------
# Obtener empresas asignadas a un usuario concreto
# GET /api/companies/assigned/{user_id}
# -----------------
@router.get("/assigned/{user_id}", response_model=List[CompanyResponse])
async def get_assigned_companies(user_id: int, db: AsyncSession = Depends(get_db)):
    companies = await companies_service.get_companies_by_user(db, user_id)
    return companies


# -----------------
# Obtener empresas de un usuario con info del comercial responsable
# GET /api/companies/assigned/{user_id}/with-manager
# -----------------
@router.get(
    "/assigned/{user_id}/with-manager", response_model=List[CompanyWithManagerResponse]
)
async def get_assigned_companies_with_manager(
    user_id: int, db: AsyncSession = Depends(get_db)
):
    return await companies_service.get_companies_with_manager_by_user(db, user_id)


# -----------------
# Obtener una empresa por ID
# GET /api/companies/{company_id}
# -----------------
@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: int, db: AsyncSession = Depends(get_db)):
    try:
        return await companies_service.get_company_by_id(db, company_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# -----------------
# Obtener las ofertas (vacantes) de una empresa
# GET /api/companies/{company_id}/vacants
# -----------------
@router.get("/{company_id}/vacants")
async def get_company_vacancies(
    company_id: int, db: AsyncSession = Depends(get_db)
):
    """
    Devuelve todas las ofertas vinculadas a una empresa, para poder
    agruparlas dentro de su ficha de cliente.
    """
    result = await db.execute(
        select(JobOffer)
        .where(JobOffer.company_id == company_id)
        .order_by(JobOffer.published_at.desc().nullslast())
    )
    offers = result.scalars().all()
    return [
        {
            "id": o.id,
            "title": o.title,
            "status": o.status.value if hasattr(o.status, "value") else o.status,
            "location": o.location,
            "published_at": o.published_at,
        }
        for o in offers
    ]


# -----------------
# Crear una empresa
# POST /api/companies
# -----------------
@router.post("", response_model=CompanyResponse, status_code=201)
async def create_company(
    company_data: CompanyCreate, db: AsyncSession = Depends(get_db)
):
    try:
        return await companies_service.create_company(db, company_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# -----------------
# Actualizar una empresa
# PATCH /api/companies/{company_id}
# -----------------
@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int, company_data: CompanyUpdate, db: AsyncSession = Depends(get_db)
):
    try:
        return await companies_service.update_company(db, company_id, company_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# -----------------
# Eliminar una empresa
# DELETE /api/companies/{company_id}
# -----------------
@router.delete("/{company_id}", response_model=MessageResponse)
async def delete_company(company_id: int, db: AsyncSession = Depends(get_db)):
    try:
        return await companies_service.delete_company(db, company_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# -----------------
# Asignar masivamente empresas a un usuario
# POST /api/companies/assign-user
# -----------------
@router.post("/assign-user", response_model=MessageResponse)
async def assign_user_to_companies(
    body: CompanyAssignRequest, db: AsyncSession = Depends(get_db)
):
    assigned_count = await companies_service.assign_user_to_companies(
        db, body.user_id, body.company_ids
    )

    return {
        "message": f"Se han asignado {assigned_count} empresas al usuario correctamente."
    }


# -----------------
# Añadir comentario a empresa
# POST /api/companies/{company_id}/comments
# -----------------
@router.post("/{company_id}/comments", response_model=CommentResponse)
async def create_company_comment(
    company_id: int,
    body: CommentCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await comments_service.add_company_comment(
            db, company_id, body, user_id=current_user["id"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------
# Modificar comentario de empresa
# PATCH /api/companies/comments/{comment_id}
# -----------------
@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def modify_company_comment(
    comment_id: int, body: CommentUpdate, db: AsyncSession = Depends(get_db)
):
    updated = await comments_service.update_company_comment(
        db, comment_id, body.comment
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    return updated


# -----------------
# Obtener comentarios de empresa
# GET /api/companies/{company_id}/comments
# -----------------
@router.get("/{company_id}/comments", response_model=List[CommentResponse])
async def get_company_comments(company_id: int, db: AsyncSession = Depends(get_db)):
    return await comments_service.get_company_comments(db, company_id)

# -----------------
# Eliminar comentario de empresa
# DELETE /api/companies/comments/{comment_id}
# -----------------
@router.delete("/comments/{comment_id}", response_model=MessageResponse)
async def delete_company_comment(
    comment_id: int, db: AsyncSession = Depends(get_db)
):
    deleted = await comments_service.delete_company_comment(db, comment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    return {"message": "Comentario eliminado correctamente"}


# -----------------
# Interacciones comerciales de empresa (llamadas, reuniones, emails...)
# -----------------
@router.get(
    "/{company_id}/interactions", response_model=List[CompanyInteractionOut]
)
async def list_company_interactions(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(TrackingHistory, User.name, User.email)
        .outerjoin(User, User.id == TrackingHistory.user_id)
        .where(TrackingHistory.company_id == company_id)
        .order_by(TrackingHistory.recorded_at.desc())
    )
    return [
        CompanyInteractionOut(
            id=t.id,
            tipo=t.action_type,
            texto=t.comments,
            fecha=t.recorded_at,
            autor=nombre or email,
        )
        for t, nombre, email in result.all()
    ]


@router.post(
    "/{company_id}/interactions",
    response_model=CompanyInteractionOut,
    status_code=201,
)
async def create_company_interaction(
    company_id: int,
    body: CompanyInteractionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="La empresa no existe")

    nueva = TrackingHistory(
        company_id=company_id,
        action_type=(body.tipo or "nota")[:255],
        comments=body.texto,
        user_id=current_user.get("id"),
    )
    db.add(nueva)
    await db.commit()
    await db.refresh(nueva)

    return CompanyInteractionOut(
        id=nueva.id,
        tipo=nueva.action_type,
        texto=nueva.comments,
        fecha=nueva.recorded_at,
        autor=current_user.get("name") or current_user.get("email"),
    )


@router.delete("/interactions/{interaction_id}", response_model=MessageResponse)
async def delete_company_interaction(
    interaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    interaccion = await db.get(TrackingHistory, interaction_id)
    # Solo se borran interacciones de empresa (no notas de vacantes)
    if interaccion is None or interaccion.company_id is None:
        raise HTTPException(status_code=404, detail="Interacción no encontrada")
    await db.delete(interaccion)
    await db.commit()
    return {"message": "Interacción eliminada correctamente"}


# -----------------
# Documentos de empresa (contratos, propuestas, facturas...)
# -----------------
@router.get("/{company_id}/documents", response_model=List[CompanyDocumentOut])
async def list_company_documents(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(CompanyDocument)
        .where(CompanyDocument.company_id == company_id)
        .order_by(CompanyDocument.uploaded_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/{company_id}/documents", response_model=CompanyDocumentOut, status_code=201
)
async def upload_company_document(
    company_id: int,
    file: UploadFile = File(...),
    tipo: str = Form("Otro"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="La empresa no existe")

    contenido = await file.read()
    if not contenido:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    extension = os.path.splitext(file.filename or "")[1].lower()[:10]
    stored_name = f"empresa{company_id}_{uuid.uuid4().hex[:10]}{extension}"
    with open(os.path.join(COMPANY_DOCS_DIR, stored_name), "wb") as f:
        f.write(contenido)

    doc = CompanyDocument(
        company_id=company_id,
        tipo=(tipo or "Otro")[:50],
        original_name=(file.filename or stored_name)[:255],
        stored_name=stored_name,
        size_bytes=len(contenido),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/documents/{doc_id}/download")
async def download_company_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    doc = await db.get(CompanyDocument, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    file_path = os.path.join(COMPANY_DOCS_DIR, doc.stored_name)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404, detail="El archivo no existe en el servidor"
        )
    return FileResponse(file_path, filename=doc.original_name)


@router.delete("/documents/{doc_id}", response_model=MessageResponse)
async def delete_company_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    doc = await db.get(CompanyDocument, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    file_path = os.path.join(COMPANY_DOCS_DIR, doc.stored_name)
    await db.delete(doc)
    await db.commit()
    try:
        os.remove(file_path)
    except OSError:
        pass
    return {"message": "Documento eliminado correctamente"}
