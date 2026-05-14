from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.jwt import get_current_user_db
from app.db.connection import get_db
from app.models.user_model import User
from app.schemas.chat_schemas import (
    ConversationCreate,
    ConversationOut,
    MessageCreate,
    MessageOut,
    MessagesPage,
)
from app.services import chat_service

router = APIRouter()


@router.post("", response_model=ConversationOut, status_code=201)
async def create_or_get_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    conv = await chat_service.get_or_create_conversation(db, current_user.id, body.other_user_id)
    await chat_service.update_last_seen(db, current_user.id)
    convs = await chat_service.list_conversations(db, current_user.id)
    conv_out = next((c for c in convs if c.id == conv.id), None)
    if not conv_out:
        raise HTTPException(status_code=500, detail="Error al recuperar la conversación")
    return conv_out


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    await chat_service.update_last_seen(db, current_user.id)
    return await chat_service.list_conversations(db, current_user.id)


# /offline must be registered before /{conv_id} routes to avoid being matched as a conv_id
@router.post("/offline", status_code=204)
async def mark_offline(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    await chat_service.mark_offline(db, current_user.id)


@router.get("/{conv_id}/messages", response_model=MessagesPage)
async def get_messages(
    conv_id: int,
    cursor: Optional[str] = None,
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    parsed_cursor: Optional[datetime] = None
    if cursor:
        try:
            parsed_cursor = datetime.fromisoformat(cursor)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de cursor inválido")

    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="El límite debe estar entre 1 y 100")

    return await chat_service.get_messages(db, conv_id, current_user.id, parsed_cursor, limit)


@router.post("/{conv_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    conv_id: int,
    body: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    await chat_service.update_last_seen(db, current_user.id)
    return await chat_service.send_message(db, conv_id, current_user.id, body.content)


@router.patch("/{conv_id}/read", status_code=204)
async def mark_as_read(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    await chat_service.mark_as_read(db, conv_id, current_user.id)


@router.delete("/{conv_id}/messages/{message_id}", status_code=204)
async def delete_message(
    conv_id: int,
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    await chat_service.delete_message(db, message_id, current_user.id, conv_id)
