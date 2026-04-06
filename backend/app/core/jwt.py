from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings

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