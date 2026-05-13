from sqlalchemy import select

from fastapi import APIRouter, Depends, HTTPException
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
)
from app.schemas.comments_schemas import CommentCreate, CommentUpdate, CommentResponse
from app.services import comments_service
from app.schemas.users_schemas import MessageResponse
from app.models.companies_model import Company

router = APIRouter()


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

    if entity_type:
        query = query.where(Company.entity_type == entity_type)

    query = query.order_by(Company.created_at.desc())

    result = await db.execute(query)
    clients = result.scalars().all()

    return clients


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
        raise HTTPException(status_code=500, detail=str(e))


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
    company_id: int, body: CommentCreate, db: AsyncSession = Depends(get_db)
):
    try:
        return await comments_service.add_company_comment(db, company_id, body)
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
