from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from typing import List

from app.schemas.users_schemas import NewUser, UserResponse, UserUpdate, MessageResponse, NotificationPrefsUpdate
from app.services import users_service
from app.db.connection import get_db
from app.core.jwt import get_current_user_db
from app.models.user_model import User
from sqlalchemy import update

router = APIRouter() 

# -----------------
# Perfil propio
# GET /api/users/me
# -----------------
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user_db),
):
    return current_user


# ---------------------------------
# Preferencias de notificación
# PATCH /api/users/me/notifications
# ---------------------------------
@router.patch("/me/notifications", response_model=UserResponse)
async def update_notifications(
    body: NotificationPrefsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(email_notifications=body.email_notifications)
    )
    await db.commit()
    current_user.email_notifications = body.email_notifications
    return current_user


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
# Obtener usuarios
# GET /api/users
# -----------------

@router.get("", response_model=List[UserResponse]) 
async def get_all_users(db: AsyncSession = Depends(get_db)):
    usuarios = await users_service.get_all_users(db)
    return usuarios


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