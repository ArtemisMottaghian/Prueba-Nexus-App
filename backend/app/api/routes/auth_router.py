from fastapi import APIRouter,Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.db.connection import get_db
from app.services import users_service
from app.core.security import verify_password
from app.core.jwt import create_access_token
from app.core.config import settings
from app.schemas.users_schemas import TokenResponse


router = APIRouter()

@router.post("",response_model=TokenResponse)
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


@router.get("/google/login")
def google_login():
    """Redirige al usuario a la pantalla de consentimiento de Google"""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(settings.GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{settings.GOOGLE_AUTH_URL}?{query}")

@router.get("/google/callback")
async def google_callback(code: str, db:AsyncSession = Depends(get_db)):
    """Google redirige aqui con el codigo. Lo intercambiamos por tokens"""

    # Codigo -> Tokens
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            settings.GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Error al obtener los tokens de Google")
    
    tokens = token_res.json()

    # Access token -> datos del usuario
    async with httpx.AsyncClient() as client:
        userinfo_res = await client.get(
            settings.GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
    
    if userinfo_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Error al obtener datos del usuario")
    
    userinfo = userinfo_res.json()

    # Buscar el usuario en la db por email
    usuario = await users_service.getUser(db, userinfo["email"])
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una cuenta con este correo de Google. Registrate primero"
        )
    
    # Guardar los tokens de google antes de emitir el JWT
    usuario.google_access_token = tokens["access_token"]
    usuario.google_refresh_token = tokens.get("refresh_token")
    await db.commit()
    # Generar el mismo JWT que usa el resto de la app
    token_data = {
        "sub": usuario.email,
        "role": usuario.role.value,
        "id": usuario.id
    }
    access_token = create_access_token(data=token_data)

    frontend_url = f"http://nexus.ara-tech.es/auth/google/callback?token={access_token}"
    return RedirectResponse(url=frontend_url)