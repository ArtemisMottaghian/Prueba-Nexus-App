from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.schemas.clients_schemas import ClientUpdate, ClientOut
from app.services import clients_service
from app.db.connection import get_db

router = APIRouter()

# --------------------
# ACTUALIZAR cliente parcialmente
# PATCH /api/clients/{client_id}
# --------------------
@router.patch("/{client_id}", response_model=ClientOut)
async def endpoint_updateClient(
    client_id: int,
    client_data: ClientUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza uno o varios campos de un cliente existente
    """
    try:
        cliente_actualizado = await clients_service.update_client(db, client_id, client_data)
        return cliente_actualizado
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en la base de datos")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))