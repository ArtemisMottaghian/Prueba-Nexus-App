from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from typing import List

from app.schemas.clients_schemas import ClientUpdate, ClientOut, ClientDetailOut, ClientCreate, VacancyOut,MessageResponse
from app.services import clients_service
from app.db.connection import get_db
from backend.app.services import comments_service

from app.schemas.comments_schemas import CommentCreate, CommentUpdate, CommentResponse
from app.services import comments_service

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
        raise HTTPException(status_code=500, detail="Error interno del servidor")

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
        raise HTTPException(status_code=500, detail="Error interno del servidor")

# --------------------
# Obtener un cliente con las vacantes asociadas
# GET /api/clients/{client_id}/vacantes
# --------------------
@router.get("/{client_id}/vacancies", response_model=List[VacancyOut])
async def get_client_vacancies(client_id: int, db: AsyncSession = Depends(get_db)):
    try:
        client_vacancies = await clients_service.get_client_vacancies(db, client_id)
        return client_vacancies
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en la base de datos")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")
    
# --------------------
# Crear un cliente
# POST /api/clients/
# --------------------
@router.post("", response_model=ClientOut, status_code=201)
async def create_client(client_data: ClientCreate, db: AsyncSession = Depends(get_db)):
    try:
        cliente_creado = await clients_service.create_client(db, client_data)
        return cliente_creado
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de la integridad en la base de datos")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")

# --------------------
# ACTUALIZAR cliente parcialmente
# PUT /api/clients/{client_id}
# --------------------
@router.patch("/{client_id}", response_model=ClientOut)
async def update_client(
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
        raise HTTPException(status_code=500, detail="Error interno del servidor")
    
# --------------------
# DELETE cliente 
# DELETE /api/clients/{client_id}
# --------------------
@router.delete("/{client_id}",response_model=MessageResponse)
async def delete_client(client_id: int, db: AsyncSession = Depends(get_db)):
    try:
        cliente_eliminado = await clients_service.delete_client(db, client_id)
        return cliente_eliminado
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en la base de datos")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")
    
# Añadir nota a cliente
@router.post("/{client_id}/comments", response_model=CommentResponse)
async def create_client_note(
    client_id: int,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        return await comments_service.add_client_comment(db, client_id, body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Modificar nota de cliente
@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def modify_client_note(
    comment_id: int,
    body: CommentUpdate,
    db: AsyncSession = Depends(get_db)
):
    updated_comment = await comments_service.update_client_comment(db, comment_id, body.comment)
    if not updated_comment:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return updated_comment
