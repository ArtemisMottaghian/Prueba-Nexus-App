from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.connection import get_db
from app.services import companies_service
from app.schemas.companies_schemas import CompanyAssignRequest, CompanyResponse
from app.schemas.comments_schemas import CommentCreate, CommentUpdate, CommentResponse
from app.services import comments_service
from app.schemas.users_schemas import MessageResponse

router = APIRouter()

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
# Obtener empresas asignadas a un usuario concreto
# GET /api/companies/assigned/{user_id}
# -----------------
@router.get("/assigned/{user_id}", response_model=List[CompanyResponse])
async def get_assigned_companies(user_id: int, db: AsyncSession = Depends(get_db)):
    companies = await companies_service.get_companies_by_user(db, user_id)
    return companies


# -----------------
# Añadir comentario a empresa
# POST /api/companies/{company_id}/comments
# -----------------
@router.post("/{company_id}/coments", response_model=CommentResponse)
async def create_company_comment(company_id: int, body: CommentCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await comments_service.add_company_comment(db, company_id, body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# -----------------
# Modificar comentario de empresa
# PATCH /api/companies/comments/{comment_id}
# -----------------
@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def modify_company_comment(comment_id: int, body: CommentUpdate, db: AsyncSession = Depends(get_db)):
    updated = await comments_service.update_company_comment(db, comment_id, body.comment)
    if not updated:
        raise HTTPException(stauts_code=404, detail="Comentario no encontrado")
    return updated

# -----------------
# Obtener comentarios de empresa
# GET /api/companies/{company_id}/comments
# -----------------
@router.get("/{company_id}/comments", response_model=List[CommentResponse])
async def get_company_comments(company_id: int, db:AsyncSession = Depends(get_db)):
    return await comments_service.get_company_comments(db, company_id)