from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from typing import List

from app.schemas.clients_schemas import ClientUpdate, ClientOut, ClientDetailOut
from app.services import clients_service
from app.db.connection import get_db

router = APIRouter()
# --------------------
# Listar clientes 
# GET /api/clients
# --------------------
@router.get("", response_model=List[ClientOut])
async def endpoint_list_clients(db: AsyncSession = Depends(get_db)):
    try:
        clients = await clients_service.get_all_clients(db)
        return clients
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en la base de datos")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------
# Obtener un cliente con detalles de la vacante 
# GET /api/clients/{client_id}
# --------------------
@router.get("/{client_id}", response_model=ClientDetailOut)
async def get_client(client_id: int, db: AsyncSession = Depends(get_db)):
    try:
        client = await clients_service.get_client_by_id(db, client_id)
        return client
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en la base de datos")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# --------------------
# ACTUALIZAR cliente parcialmente
# PUT /api/clients/{client_id}
# --------------------
@router.put("/{client_id}", response_model=ClientOut)
async def endpoint_update_client(
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
    
@router.delete("/client_id")
async def delete_client(client_id: int, db: AsyncSession = Depends(get_db)):
    try:
        cliente_eliminado = await clients_service.delete_client(db, client_id)
        return cliente_eliminado
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en la base de datos")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))