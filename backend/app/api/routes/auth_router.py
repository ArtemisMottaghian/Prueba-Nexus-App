import asyncio
import smtplib
from email.message import EmailMessage

from fastapi import APIRouter,Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.db.connection import get_db
from app.services import users_service
from app.core.security import verify_password, hash_password
from app.core.jwt import create_access_token
from app.core.config import settings
from app.schemas.users_schemas import TokenResponse, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
from app.core.jwt import get_current_user_db
from app.models.user_model import User

RESET_TOKEN_EXPIRE_MINUTES = 30


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

    frontend_url = f"{settings.FRONTEND_URL}/auth/google/callback?token={access_token}"
    return RedirectResponse(url=frontend_url)


def _create_reset_token(email: str) -> str:
    from datetime import datetime, timedelta, timezone
    payload = {
        "sub": email,
        "purpose": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def _send_reset_email(to_email: str, token: str):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    msg = EmailMessage()
    msg["Subject"] = "Restablecer contraseña — Nexus"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.set_content(f"Haz clic en el siguiente enlace para restablecer tu contraseña:\n\n{reset_url}\n\nEste enlace expira en {RESET_TOKEN_EXPIRE_MINUTES} minutos.")
    msg.add_alternative(f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Restablecer contraseña</h2>
      <p>Haz clic en el botón para crear una nueva contraseña. El enlace expira en <strong>{RESET_TOKEN_EXPIRE_MINUTES} minutos</strong>.</p>
      <a href="{reset_url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
        Restablecer contraseña
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px">Si no solicitaste este cambio, ignora este mensaje.</p>
    </div>
    """, subtype="html")

    def _smtp_send():
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

    await asyncio.to_thread(_smtp_send)


async def _send_reset_email_silent(to_email: str, token: str):
    try:
        await _send_reset_email(to_email, token)
    except Exception as e:
        print(f"[ERROR] forgot_password email to {to_email}: {e}")


@router.post("/forgot-password", status_code=204)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    # Verificar SMTP antes de consultar la BD — evita revelar si el email existe
    # en caso de que el servicio no esté configurado (retornaría 503 solo para emails válidos)
    if not settings.SMTP_HOST:
        raise HTTPException(status_code=503, detail="Servicio de email no configurado")

    usuario = await users_service.getUser(db, body.email)

    # Respuesta siempre 204 aunque el email no exista — evita enumeración de usuarios.
    # El email se envía en background para que el tiempo de respuesta sea constante
    # independientemente de si el usuario existe o no.
    # Nota: el token JWT no es de un solo uso — válido hasta expiración (30 min).
    # Para single-use se requeriría una tabla de tokens en BD (mejora futura).
    if not usuario or not usuario.is_active:
        return

    token = _create_reset_token(usuario.email)
    asyncio.create_task(_send_reset_email_silent(usuario.email, token))


@router.post("/reset-password", status_code=204)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = jwt.decode(body.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    if payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Token inválido")

    email = payload.get("sub")
    usuario = await users_service.getUser(db, email)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.password_hash = hash_password(body.new_password)
    await db.commit()


@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    current_user.password_hash = hash_password(body.new_password)
    await db.commit()