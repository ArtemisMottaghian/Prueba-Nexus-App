import os

import urllib.parse
from sqlalchemy import select
from app.core.jwt import get_current_user_db
from app.models.user_model import User
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from google_auth_oauthlib.flow import Flow

from app.db.session import get_db
from app.services.email_service import send_company_vacancy_email
from app.schemas.email_templates_schemas import ManualProspectEmail

router = APIRouter()

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


@router.get("/google/login")
async def google_login(current_user: User = Depends(get_current_user_db)):
    """
    El usuario hace clic aquí para conectar su cuenta.
    """
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI"),
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
        "state": str(current_user.id),
    }

    auth_url = f"{base_url}?{urllib.parse.urlencode(params)}"

    return {"url": auth_url}


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Paso 2: Google devuelve al usuario aquí con un 'code'.
    Cambiamos ese 'code' por un Token y lo guardamos.
    """
    code = request.query_params.get("code")
    user_id = request.query_params.get("state")

    if not code:
        raise HTTPException(status_code=400, detail="No se recibió el código de Google")

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://accounts.google.com/o/oauth2/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )

    flow.fetch_token(code=code)
    credentials = flow.credentials

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    base_url = os.getenv("FRONTEND_URL", "https://nexus.ara-tech.es").rstrip("/")
    target_url = f"{base_url}/cuenta"

    if user:
        user.google_refresh_token = credentials.refresh_token
        await db.commit()

        return RedirectResponse(url=f"{target_url}?google_success=true")


@router.post("/send-prospect", status_code=202)
async def send_manual_prospect_template(
    data: ManualProspectEmail,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    """
    Envía manualmente un email de captación a una empresa.
    Los datos se reciben a través del body de la petición.
    """

    if not current_user.google_refresh_token:
        raise HTTPException(status_code=400, detail="Debes conectar tu Gmail primero")

    success = background_tasks.add_task(
        send_company_vacancy_email,
        db=db,
        user=current_user,
        company_email=data.company_email,
        company_name=data.company_name,
        job_title=data.job_title,
    )

    return {
        "status": "accepted",
        "message": "El ha sido enviado",
    }


@router.get("/google/status")
async def get_google_status(current_user: User = Depends(get_current_user_db)):
    """
    Indica al frontend si el usuario actual tiene su cuenta vinculada.
    """
    return {
        "is_linked": current_user.google_refresh_token is not None,
        "email": current_user.email,
    }


@router.delete("/google/unlink")
async def unlink_google_account(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db),
):
    """
    Borra el token de Google del usuario, desvinculando su cuenta.
    """
    current_user.google_refresh_token = None
    await db.commit()

    return {"message": "Cuenta de Google desvinculada correctamente"}

CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


@router.get("/google/calendar/login")
async def google_calendar_login(current_user: User = Depends(get_current_user_db)):
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "redirect_uri": os.getenv("GOOGLE_CALENDAR_REDIRECT_URI"),
        "response_type": "code",
        "scope": " ".join(CALENDAR_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": str(current_user.id),
    }
    auth_url = f"{base_url}?{urllib.parse.urlencode(params)}"
    return {"url": auth_url}


@router.get("/google/calendar/callback")
async def google_calendar_callback(request: Request, db: AsyncSession = Depends(get_db)):
    code = request.query_params.get("code")
    user_id = request.query_params.get("state")

    if not code:
        raise HTTPException(status_code=400, detail="No se recibió el código de Google")

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://accounts.google.com/o/oauth2/token",
            }
        },
        scopes=CALENDAR_SCOPES,
        redirect_uri=os.getenv("GOOGLE_CALENDAR_REDIRECT_URI"),
    )

    flow.fetch_token(code=code)
    credentials = flow.credentials

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    base_url = os.getenv("FRONTEND_URL", "https://nexus.ara-tech.es").rstrip("/")

    if user:
        user.google_access_token = credentials.token
        if credentials.refresh_token:
            user.google_calendar_refresh_token = credentials.refresh_token
        await db.commit()
        return RedirectResponse(url=f"{base_url}/cuenta?calendar_success=true")

    raise HTTPException(status_code=404, detail="Usuario no encontrado")


@router.get("/google/calendar/status")
async def get_calendar_status(current_user: User = Depends(get_current_user_db)):
    return {
        "is_linked": current_user.google_access_token is not None,
        "email": current_user.email,
    }