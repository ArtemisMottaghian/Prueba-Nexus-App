from fastapi import HTTPException
from sqlalchemy import update, select, delete
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from typing import List

from app.models.companies_model import Company
from app.models.contacts_model import Contact
from app.models.job_model import JobOffer
from app.models.user_model import User
from app.schemas.users_schemas import UserType
from app.schemas.companies_schemas import CompanyCreate, CompanyUpdate, CompanyResponse, CompanyWithManagerResponse


async def _get_company_or_404(db: AsyncSession, company_id: int) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalars().first()
    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company with ID {company_id} not found"
        )
    return company


async def get_all_companies(db: AsyncSession) -> List[CompanyResponse]:
    try:
        result = await db.execute(select(Company).order_by(Company.id.asc()))
        companies = result.scalars().all()
        return [CompanyResponse.model_validate(c) for c in companies]
    except SQLAlchemyError as e:
        print(f"Error al obtener empresas: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving company list")


async def get_company_by_id(db: AsyncSession, company_id: int) -> CompanyResponse:
    try:
        company = await _get_company_or_404(db, company_id)
        return CompanyResponse.model_validate(company)
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        print(f"Error al obtener empresa {company_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving company")


async def get_companies_by_user(db: AsyncSession, user_id: int) -> List[CompanyResponse]:
    """Devuelve todas las empresas asignadas a un usuario concreto."""
    try:
        result = await db.execute(
            select(Company).where(Company.managed_by_id == user_id).order_by(Company.id.asc())
        )
        companies = result.scalars().all()
        return [CompanyResponse.model_validate(c) for c in companies]
    except SQLAlchemyError as e:
        print(f"Error al obtener empresas del usuario {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving companies by user")


async def create_company(db: AsyncSession, company_data: CompanyCreate) -> CompanyResponse:
    try:
        new_company = Company(
            name=company_data.name,
            cif=company_data.cif,
            sector=company_data.sector,
            website=company_data.website,
            linkedin_url=company_data.linkedin_url,
            address=company_data.address,
            lead_status=company_data.lead_status,
            source_id=company_data.source_id,
            original_offer_id=company_data.original_offer_id,
            notes=company_data.notes,
        )
        db.add(new_company)
        await db.commit()
        await db.refresh(new_company)
        return CompanyResponse.model_validate(new_company)
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al crear empresa: {e}")
        raise HTTPException(status_code=500, detail="Error creating company")


async def update_company(db: AsyncSession, company_id: int, company_data: CompanyUpdate) -> CompanyResponse:
    try:
        company = await _get_company_or_404(db, company_id)
        # model_dump(exclude_unset=True) solo devuelve los campos enviados en el body
        update_data = company_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(company, field, value)

        await db.commit()
        await db.refresh(company)
        return CompanyResponse.model_validate(company)
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al actualizar empresa {company_id}: {e}")
        raise HTTPException(status_code=500, detail="Error updating company")



async def delete_company(db: AsyncSession, company_id: int) -> dict:
    try:
        company = await _get_company_or_404(db, company_id)
        await db.delete(company)
        await db.commit()
        return {"message": "Company deleted successfully"}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al eliminar empresa {company_id}: {e}")
        raise HTTPException(status_code=500, detail="Error deleting company")


async def assign_user_to_companies(
    db: AsyncSession, user_id: int, company_ids: List[int]
) -> int:
    """
    Asigna masivamente una lista de empresas a un usuario con rol 'company'.
    """
    if not company_ids:
        return 0

    try:
        # 1. Validar que el usuario existe y tiene el rol 'company'
        user_query = select(User).where(User.id == user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="El usuario no existe.")

        if user.role != UserType.company:
            raise HTTPException(
                status_code=400,
                detail=f"El usuario debe tener el rol '{UserType.company.value}' para gestionar empresas.",
            )

        # 2. Actualización masiva de las empresas - asigna managed_by_id a todas las empresas indicadas

        stmt = (
            update(Company)
            .where(Company.id.in_(company_ids))
            .values(managed_by_id=user_id)
            .execution_options(synchronize_session="fetch")
        )

        result = await db.execute(stmt)
        await db.commit()

        return result.rowcount

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error al asignar empresas: {e}")
        raise e


async def get_companies_with_manager_by_user(
    db: AsyncSession, user_id: int
) -> List[CompanyWithManagerResponse]:
    """Devuelve las empresas de un usuario incluyendo datos del comercial asignado."""
    try:
        result = await db.execute(
            select(Company)
            .options(joinedload(Company.manager))
            .where(Company.managed_by_id == user_id)
            .order_by(Company.id.asc())
        )
        companies = result.scalars().all()

        responses = []
        for c in companies:
            base = CompanyWithManagerResponse.model_validate(c)
            base.managed_by_id = c.managed_by_id
            if c.manager:
                base.manager_name = c.manager.name
                base.manager_email = c.manager.email
            responses.append(base)
        return responses
    except SQLAlchemyError as e:
        print(f"Error al obtener empresas con manager del usuario {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving companies with manager")
