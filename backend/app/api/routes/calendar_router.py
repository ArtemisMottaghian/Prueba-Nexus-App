from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional

from app.db.connection import get_db
from app.core.jwt import get_current_user
from app.services import calendar_service

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
    current_user: dict = Depends(get_current_user)
):
    """Obtiene los próximos eventos del calendario del usuario."""
    try:
        access_token = current_user.get("google_access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="No hay token de Google Calendar")
        events = await calendar_service.get_events(access_token)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/")
async def create_event(
    event_data: EventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Crea un nuevo evento en Google Calendar."""
    try:
        access_token = current_user.get("google_access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="No hay token de Google Calendar")
        event = await calendar_service.create_event(access_token, event_data.dict())
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{event_id}")
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Actualiza un evento existente."""
    try:
        access_token = current_user.get("google_access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="No hay token de Google Calendar")
        event = await calendar_service.update_event(access_token, event_id, event_data.dict())
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Elimina un evento del calendario."""
    try:
        access_token = current_user.get("google_access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="No hay token de Google Calendar")
        await calendar_service.delete_event(access_token, event_id)
        return {"message": "Evento eliminado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))