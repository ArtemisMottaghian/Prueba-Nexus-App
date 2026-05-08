from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.db.connection import get_db
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user_model import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/login')

def create_access_token(data: dict):
    to_enconde = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    to_enconde.update({'exp': expire})
    encoded_jwt = jwt.encode(to_enconde, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def get_current_user(token:str = Depends(oauth2_scheme)):
    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Token invalido o expirado',
            headers={'WWW-Authenticate': 'Bearer'}
        )
    return payload


async def get_current_user_db(
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_current_user),
):
    """
    Nueva dependencia que transforma el payload del token
    en un objeto de usuario real de la base de datos.
    """
    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(
            status_code=401, detail="Token sin identificación de usuario"
        )

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404, detail="Usuario no encontrado en el sistema"
        )

    return user
