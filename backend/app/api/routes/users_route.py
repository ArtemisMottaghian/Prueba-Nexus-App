from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.schemas.users_schemas import NewUser, UserResponse,UserUpdate, MessageResponse
from app.services import users_service
from app.db.connection import get_db

router = APIRouter() 

# --------------------
# CREAR usuario
# POST /api/users
# -----------------
@router.post("", response_model=UserResponse,status_code=201)
async def create_user(
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
# GET /api/users/{email} 
# -----------------
@router.get("/{email}", response_model=UserResponse)
async def get_user(
    email: str, 
    db: AsyncSession = Depends(get_db)
):
    usuario = await users_service.getUser(db, email)
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    return usuario

# -----------------
# Actualizar usuario
# PATCH /api/users/{email}
# -----------------
@router.patch("/{email}", response_model=UserResponse)
async def update_user(
    email: str,
    datos: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    usuario = await users_service.update_user(db, email, datos)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario

# -----------------
# Eliminar usuario
# DELETE /api/users/{email}
# -----------------
@router.delete("/{email}", response_model=MessageResponse)
async def delete_user(
    email: str,
    db: AsyncSession = Depends(get_db)
):
    success = await users_service.delete_user(db, email)
    if not success:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado correctamente"}