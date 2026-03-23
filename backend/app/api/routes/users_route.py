from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.schemas.users_schemas import NewUser, UserResponse
from app.services import users_service
from app.db.connection import get_db

router = APIRouter() 

# --------------------
# CREAR usuario
# POST /api/usuarios
# -----------------
@router.post("", response_model=UserResponse)
async def endpoint_newUser(
    datos_cliente: NewUser, 
    db: AsyncSession = Depends(get_db)
):
    try:
        nuevo_user = await users_service.newUser(db, datos_cliente)
        return nuevo_user
        
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="El email ya está registrado")


# -----------------
# Obtener usuario por email
# GET /api/usuarios/{email} 
# -----------------
@router.get("/{email}", response_model=UserResponse)
async def endpoint_getUser(
    email: str, 
    db: AsyncSession = Depends(get_db)
):
    usuario = await users_service.getUser(db, email)
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    return usuario