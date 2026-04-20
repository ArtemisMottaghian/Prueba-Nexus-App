from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional

from app.db.connection import get_db
from app.core.jwt import get_current_user
from app.services import calendar_service, users_service

router = APIRouter(tags=["Calendario"])


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    start: str  # ISO format: "2026-04-08T10:00:00"
    end: str    # ISO format: "2026-04-08T11:00:00"
    attendees: Optional[List[str]] = []


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None


@router.get("/")
async def get_events(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene los próximos eventos del calendario del usuario."""
    usuario = await users_service.getUser(db, current_user["sub"])
    if not usuario or not usuario.google_access_token:
        raise HTTPException(status_code=401, detail="No hay token de Google Calendar. Inicia sesión con Google.")
    try:
        events = await calendar_service.get_events(usuario.google_access_token)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/")
async def create_event(
    event_data: EventCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo evento en Google Calendar."""
    usuario = await users_service.getUser(db, current_user["sub"])
    if not usuario or not usuario.google_access_token:
        raise HTTPException(status_code=401, detail="No hay token de Google Calendar. Inicia sesión con Google.")
    try:
        event = await calendar_service.create_event(usuario.google_access_token, event_data.model_dump())
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{event_id}")
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un evento existente."""
    usuario = await users_service.getUser(db, current_user["sub"])
    if not usuario or not usuario.google_access_token:
        raise HTTPException(status_code=401, detail="No hay token de Google Calendar. Inicia sesión con Google.")
    try:
        event = await calendar_service.update_event(usuario.google_access_token, event_id, event_data.model_dump())
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Elimina un evento del calendario."""
    usuario = await users_service.getUser(db, current_user["sub"])
    if not usuario or not usuario.google_access_token:
        raise HTTPException(status_code=401, detail="No hay token de Google Calendar. Inicia sesión con Google.")
    try:
        await calendar_service.delete_event(usuario.google_access_token, event_id)
        return {"message": "Evento eliminado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))