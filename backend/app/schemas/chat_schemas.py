from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator, ConfigDict


class ConversationCreate(BaseModel):
    other_user_id: int


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: Optional[int]
    content: str
    created_at: datetime
    is_deleted: bool
    is_mine: bool = False


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str]
    email: str
    role: str
    is_online: bool


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    other_user: ParticipantOut
    last_message: Optional[MessageOut]
    unread_count: int
    updated_at: datetime


class MessageCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El mensaje no puede estar vacío")
        if len(v) > 4000:
            raise ValueError("El mensaje no puede superar los 4000 caracteres")
        return v


class MessagesPage(BaseModel):
    messages: list[MessageOut]
    next_cursor: Optional[str]
    has_more: bool
