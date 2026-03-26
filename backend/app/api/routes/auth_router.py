from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.connection import get_db
from app.services import users_service
from app.core.security import verify_password
from app.core.jwt import create_access_token

router = APIRouter(tags=["Autenticación"])

@router.post("")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    usuario = await users_service.getUser(db, form_data.username)

    if not usuario or not verify_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = {
        "sub": usuario.email,
        "role": usuario.role.value,
        "id": usuario.id
    }
    access_token = create_access_token(data=token_data)

    return {"access_token": access_token, "token_type": "bearer"}