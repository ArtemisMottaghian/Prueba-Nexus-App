from fastapi import HTTPException
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.models.clients_model import Client
from app.models.user_model import User
from app.schemas.users_schemas import UserType


async def assign_user_to_clients(
    db: AsyncSession, user_id: int, client_ids: List[int]
) -> int:
    """
    Asigna masivamente una lista de empresas a un usuario con rol 'company'.
    """
    if not client_ids:
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

        # 2. Actualización masiva de las empresas
        # Se asume que la columna en el modelo Client es 'managed_by_id'
        stmt = (
            update(Client)
            .where(Client.id.in_(client_ids))
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
