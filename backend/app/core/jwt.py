from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.connection import get_db
from app.core.config import settings
from app.models.user_model import User

# auto_error=False: si no hay header Authorization no lanza 401 automáticamente,
# lo gestionamos nosotros leyendo la cookie primero.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/login', auto_error=False)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def get_current_user(
    request: Request,
    token_header: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    # Cookie httpOnly tiene prioridad; Authorization header como fallback (Swagger, API clients)
    token = request.cookies.get("access_token") or token_header
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_user_db(
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_current_user),
) -> User:
    """Resuelve el payload del token a un objeto User real de la base de datos."""
    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(status_code=401, detail="Token sin identificación de usuario")

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en el sistema")

    return user
