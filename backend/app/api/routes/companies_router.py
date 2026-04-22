from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.connection import get_db
from app.services import companies_service
from app.schemas.companies_schemas import CompanyAssignRequest, CompanyResponse

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
