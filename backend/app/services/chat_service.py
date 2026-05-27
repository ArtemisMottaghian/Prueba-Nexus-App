import asyncio
import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from fastapi import HTTPException
from sqlalchemy import select, update, delete as sql_delete, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, aliased

from app.core.encryption import encrypt, decrypt
from app.models.conversation_model import Conversation, ConversationParticipant, Message
from app.models.user_model import User
from app.schemas.chat_schemas import ConversationOut, MessageOut, MessagesPage, ParticipantOut

_ONLINE_THRESHOLD_SECONDS = 120  # 2 minutos
_EDIT_WINDOW_SECONDS = 15 * 60   # 15 minutos

# Cache en memoria para update_last_seen — evita UPDATE en cada poll
_last_seen_ts: dict[int, float] = {}
_LAST_SEEN_TTL = 30.0

# SSE: colas por usuario (soporta múltiples pestañas/conexiones por usuario)
_sse_queues: dict[int, set[asyncio.Queue]] = defaultdict(set)


def _push_to_user(user_id: int, event: dict) -> None:
    for q in _sse_queues.get(user_id, set()):
        q.put_nowait(event)


async def stream_user_events(user_id: int) -> AsyncGenerator[str, None]:
    q: asyncio.Queue = asyncio.Queue()
    _sse_queues[user_id].add(q)
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=25)
                yield f"data: {json.dumps(event, default=str)}\n\n"
            except asyncio.TimeoutError:
                yield 'data: {"type":"ping"}\n\n'
    finally:
        _sse_queues[user_id].discard(q)
        if not _sse_queues[user_id]:
            _sse_queues.pop(user_id, None)


def _is_online(last_seen_at: Optional[datetime]) -> bool:
    if not last_seen_at:
        return False
    now = datetime.now(timezone.utc)
    if last_seen_at.tzinfo is None:
        last_seen_at = last_seen_at.replace(tzinfo=timezone.utc)
    return (now - last_seen_at).total_seconds() < _ONLINE_THRESHOLD_SECONDS


def _decrypt_message(msg: Message) -> str:
    if msg.is_deleted:
        return "[Mensaje eliminado]"
    if msg.content_iv:
        try:
            return decrypt(msg.content, msg.content_iv.decode())
        except Exception:
            return "[Error al descifrar]"
    return msg.content


async def _get_participant_or_403(
    db: AsyncSession, conv_id: int, user_id: int
) -> ConversationParticipant:
    result = await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == conv_id,
                ConversationParticipant.user_id == user_id,
            )
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta conversación")
    return participant


async def get_or_create_conversation(
    db: AsyncSession, user_id: int, other_user_id: int
) -> Conversation:
    if user_id == other_user_id:
        raise HTTPException(status_code=400, detail="No puedes iniciar una conversación contigo mismo")

    other = await db.get(User, other_user_id)
    if not other:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    subq = (
        select(ConversationParticipant.conversation_id)
        .where(ConversationParticipant.user_id == other_user_id)
        .scalar_subquery()
    )
    stmt = (
        select(Conversation)
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .where(
            and_(
                ConversationParticipant.user_id == user_id,
                Conversation.id.in_(subq),
            )
        )
    )
    result = await db.execute(stmt)
    conv = result.scalars().first()
    if conv:
        return conv

    conv = Conversation()
    db.add(conv)
    await db.flush()
    db.add_all([
        ConversationParticipant(conversation_id=conv.id, user_id=user_id),
        ConversationParticipant(conversation_id=conv.id, user_id=other_user_id),
    ])
    await db.commit()
    await db.refresh(conv)
    return conv


async def list_conversations(
    db: AsyncSession, user_id: int, include_archived: bool = False
) -> list[ConversationOut]:
    archived_filter = (
        ConversationParticipant.is_archived.is_(True)
        if include_archived
        else ConversationParticipant.is_archived.is_(False)
    )

    stmt = (
        select(Conversation)
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .where(and_(ConversationParticipant.user_id == user_id, archived_filter))
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
        )
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    conversations = result.scalars().unique().all()

    if not conversations:
        return []

    conv_ids = [c.id for c in conversations]

    # Query 3: último mensaje de todas las conversaciones en batch
    last_id_subq = (
        select(
            Message.conversation_id,
            func.max(Message.id).label("max_id"),
        )
        .where(Message.conversation_id.in_(conv_ids))
        .group_by(Message.conversation_id)
        .subquery()
    )
    last_msgs_result = await db.execute(
        select(Message).join(last_id_subq, Message.id == last_id_subq.c.max_id)
    )
    last_msgs: dict[int, Message] = {
        m.conversation_id: m for m in last_msgs_result.scalars().all()
    }

    # Query 4: unread counts de todas las conversaciones en batch
    my_cp = aliased(ConversationParticipant)
    unread_result = await db.execute(
        select(
            Message.conversation_id,
            func.count().label("cnt"),
        )
        .join(
            my_cp,
            and_(
                my_cp.conversation_id == Message.conversation_id,
                my_cp.user_id == user_id,
            ),
        )
        .where(
            and_(
                Message.conversation_id.in_(conv_ids),
                Message.sender_id != user_id,
                Message.is_deleted.is_(False),
                or_(
                    my_cp.last_read_at.is_(None),
                    Message.created_at > my_cp.last_read_at,
                ),
            )
        )
        .group_by(Message.conversation_id)
    )
    unread_counts: dict[int, int] = {
        row.conversation_id: row.cnt for row in unread_result
    }

    output = []
    for conv in conversations:
        other_participant = next((p for p in conv.participants if p.user_id != user_id), None)
        my_participant = next((p for p in conv.participants if p.user_id == user_id), None)
        if not other_participant or not other_participant.user:
            continue

        other_user = other_participant.user
        participant_out = ParticipantOut(
            id=other_user.id,
            name=other_user.name,
            email=other_user.email,
            role=other_user.role.value if hasattr(other_user.role, "value") else str(other_user.role),
            is_online=_is_online(other_user.last_seen_at),
        )

        last_msg = last_msgs.get(conv.id)
        last_msg_out = None
        if last_msg:
            last_msg_out = MessageOut(
                id=last_msg.id,
                sender_id=last_msg.sender_id,
                content=_decrypt_message(last_msg),
                created_at=last_msg.created_at,
                is_deleted=last_msg.is_deleted,
                is_edited=last_msg.is_edited,
                edited_at=last_msg.edited_at,
                is_mine=last_msg.sender_id == user_id,
            )

        output.append(
            ConversationOut(
                id=conv.id,
                other_user=participant_out,
                last_message=last_msg_out,
                unread_count=unread_counts.get(conv.id, 0),
                updated_at=conv.updated_at,
                is_archived=my_participant.is_archived if my_participant else False,
            )
        )

    return output


async def get_messages(
    db: AsyncSession,
    conv_id: int,
    user_id: int,
    cursor: Optional[datetime],
    limit: int = 30,
) -> MessagesPage:
    await _get_participant_or_403(db, conv_id, user_id)

    stmt = (
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc())
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(Message.created_at < cursor)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    rows = rows[:limit]
    rows = list(reversed(rows))

    messages_out = [
        MessageOut(
            id=m.id,
            sender_id=m.sender_id,
            content=_decrypt_message(m),
            created_at=m.created_at,
            is_deleted=m.is_deleted,
            is_edited=m.is_edited,
            edited_at=m.edited_at,
            is_mine=m.sender_id == user_id,
        )
        for m in rows
    ]

    next_cursor = rows[0].created_at.isoformat() if has_more and rows else None

    return MessagesPage(messages=messages_out, next_cursor=next_cursor, has_more=has_more)


async def send_message(
    db: AsyncSession, conv_id: int, sender_id: int, content: str
) -> MessageOut:
    await _get_participant_or_403(db, conv_id, sender_id)

    ciphertext, iv = encrypt(content)
    msg = Message(
        conversation_id=conv_id,
        sender_id=sender_id,
        content=ciphertext,
        content_iv=iv.encode(),
    )
    db.add(msg)

    await db.execute(
        update(Conversation)
        .where(Conversation.id == conv_id)
        .values(updated_at=func.now())
    )

    await db.commit()
    await db.refresh(msg)

    msg_out = MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        content=content,
        created_at=msg.created_at,
        is_deleted=msg.is_deleted,
        is_edited=False,
        edited_at=None,
        is_mine=True,
    )

    # Notificar a los otros participantes via SSE y, si procede, por email
    await _notify_recipients(db, conv_id, sender_id, msg_out, content)

    return msg_out


async def _notify_recipients(
    db: AsyncSession,
    conv_id: int,
    sender_id: int,
    msg_out: MessageOut,
    plain_content: str,
) -> None:
    recipients = await db.execute(
        select(User)
        .join(ConversationParticipant, ConversationParticipant.user_id == User.id)
        .where(
            and_(
                ConversationParticipant.conversation_id == conv_id,
                ConversationParticipant.user_id != sender_id,
            )
        )
    )
    sender = await db.get(User, sender_id)
    sender_name = (sender.name or sender.email) if sender else "Alguien"

    recipient_msg = msg_out.model_copy(update={"is_mine": False})
    event = {
        "type": "new_message",
        "conv_id": conv_id,
        "message": recipient_msg.model_dump(mode="json"),
    }

    for user in recipients.scalars().all():
        _push_to_user(user.id, event)
        if user.email_notifications and not _is_online(user.last_seen_at):
            asyncio.create_task(
                _send_email_notification(user.email, sender_name, plain_content[:100])
            )


async def _send_email_notification(
    recipient_email: str, sender_name: str, preview: str
) -> None:
    from app.services.email_service import send_chat_notification_email
    await send_chat_notification_email(recipient_email, sender_name, preview)


async def edit_message(
    db: AsyncSession, conv_id: int, message_id: int, user_id: int, new_content: str
) -> MessageOut:
    await _get_participant_or_403(db, conv_id, user_id)

    result = await db.execute(
        select(Message).where(
            and_(Message.id == message_id, Message.conversation_id == conv_id)
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if msg.sender_id != user_id:
        raise HTTPException(status_code=403, detail="Solo puedes editar tus propios mensajes")
    if msg.is_deleted:
        raise HTTPException(status_code=400, detail="No puedes editar un mensaje eliminado")

    created = msg.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if (datetime.now(timezone.utc) - created).total_seconds() > _EDIT_WINDOW_SECONDS:
        raise HTTPException(
            status_code=400,
            detail="Solo puedes editar mensajes enviados en los últimos 15 minutos",
        )

    ciphertext, iv = encrypt(new_content)
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Message)
        .where(Message.id == message_id)
        .values(content=ciphertext, content_iv=iv.encode(), is_edited=True, edited_at=now)
    )
    await db.commit()

    msg_out = MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        content=new_content,
        created_at=msg.created_at,
        is_deleted=False,
        is_edited=True,
        edited_at=now,
        is_mine=True,
    )

    others = await db.execute(
        select(ConversationParticipant.user_id).where(
            and_(
                ConversationParticipant.conversation_id == conv_id,
                ConversationParticipant.user_id != user_id,
            )
        )
    )
    recipient_msg = msg_out.model_copy(update={"is_mine": False})
    for pid in others.scalars().all():
        _push_to_user(pid, {
            "type": "message_edited",
            "conv_id": conv_id,
            "message": recipient_msg.model_dump(mode="json"),
        })

    return msg_out


async def mark_as_read(db: AsyncSession, conv_id: int, user_id: int) -> None:
    participant = await _get_participant_or_403(db, conv_id, user_id)
    now = datetime.now(timezone.utc)
    if not participant.last_read_at or participant.last_read_at < now:
        await db.execute(
            update(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conv_id,
                    ConversationParticipant.user_id == user_id,
                )
            )
            .values(last_read_at=now)
        )
        await db.commit()


async def delete_message(
    db: AsyncSession, message_id: int, user_id: int, conv_id: int
) -> None:
    await _get_participant_or_403(db, conv_id, user_id)
    result = await db.execute(
        select(Message).where(
            and_(Message.id == message_id, Message.conversation_id == conv_id)
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if msg.sender_id != user_id:
        raise HTTPException(status_code=403, detail="Solo puedes eliminar tus propios mensajes")
    if msg.is_deleted:
        raise HTTPException(status_code=400, detail="El mensaje ya fue eliminado")

    await db.execute(
        update(Message)
        .where(Message.id == message_id)
        .values(is_deleted=True, content="", content_iv=None)
    )
    await db.commit()

    others = await db.execute(
        select(ConversationParticipant.user_id).where(
            and_(
                ConversationParticipant.conversation_id == conv_id,
                ConversationParticipant.user_id != user_id,
            )
        )
    )
    for pid in others.scalars().all():
        _push_to_user(pid, {
            "type": "message_deleted",
            "conv_id": conv_id,
            "message_id": message_id,
        })


async def get_total_unread(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count().label("total"))
        .select_from(Message)
        .join(
            ConversationParticipant,
            and_(
                ConversationParticipant.conversation_id == Message.conversation_id,
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_archived.is_(False),
            ),
        )
        .where(
            and_(
                Message.sender_id != user_id,
                Message.is_deleted.is_(False),
                or_(
                    ConversationParticipant.last_read_at.is_(None),
                    Message.created_at > ConversationParticipant.last_read_at,
                ),
            )
        )
    )
    return result.scalar() or 0


async def archive_conversation(
    db: AsyncSession, conv_id: int, user_id: int, archived: bool
) -> None:
    await _get_participant_or_403(db, conv_id, user_id)
    await db.execute(
        update(ConversationParticipant)
        .where(
            and_(
                ConversationParticipant.conversation_id == conv_id,
                ConversationParticipant.user_id == user_id,
            )
        )
        .values(is_archived=archived)
    )
    await db.commit()


async def delete_conversation(db: AsyncSession, conv_id: int, user_id: int) -> None:
    await _get_participant_or_403(db, conv_id, user_id)
    conv = await db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    all_result = await db.execute(
        select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conv_id
        )
    )
    all_ids = all_result.scalars().all()
    await db.execute(sql_delete(Conversation).where(Conversation.id == conv_id))
    await db.commit()
    for pid in all_ids:
        _push_to_user(pid, {"type": "conversation_deleted", "conv_id": conv_id})


async def mark_offline(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(User).where(User.id == user_id).values(last_seen_at=None)
    )
    await db.commit()


async def notify_typing(db: AsyncSession, conv_id: int, user_id: int) -> None:
    await _get_participant_or_403(db, conv_id, user_id)
    result = await db.execute(
        select(ConversationParticipant.user_id).where(
            and_(
                ConversationParticipant.conversation_id == conv_id,
                ConversationParticipant.user_id != user_id,
            )
        )
    )
    event = {"type": "typing", "conv_id": conv_id, "user_id": user_id}
    for row in result.all():
        _push_to_user(row.user_id, event)


async def update_last_seen(db: AsyncSession, user_id: int) -> None:
    now = time.monotonic()
    if now - _last_seen_ts.get(user_id, 0.0) < _LAST_SEEN_TTL:
        return
    _last_seen_ts[user_id] = now
    await db.execute(
        update(User).where(User.id == user_id).values(last_seen_at=func.now())
    )
    await db.commit()
