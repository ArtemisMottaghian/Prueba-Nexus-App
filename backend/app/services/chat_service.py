from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.encryption import encrypt, decrypt
from app.models.conversation_model import Conversation, ConversationParticipant, Message
from app.models.user_model import User
from app.schemas.chat_schemas import ConversationOut, MessageOut, MessagesPage, ParticipantOut

_ONLINE_THRESHOLD_SECONDS = 120  # 2 minutos


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

    # Verificar que el otro usuario existe
    other = await db.get(User, other_user_id)
    if not other:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Buscar conversación existente entre los dos (1:1)
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
    conv = result.scalar_one_or_none()
    if conv:
        return conv

    # Crear nueva conversación con ambos participantes
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


async def list_conversations(db: AsyncSession, user_id: int) -> list[ConversationOut]:
    # Obtener las conversaciones en las que participa el usuario, con participantes cargados
    stmt = (
        select(Conversation)
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .where(ConversationParticipant.user_id == user_id)
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
        )
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    conversations = result.scalars().unique().all()

    output = []
    for conv in conversations:
        # Participante actual y el otro
        my_participant = next((p for p in conv.participants if p.user_id == user_id), None)
        other_participant = next((p for p in conv.participants if p.user_id != user_id), None)

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

        # Último mensaje
        last_msg_stmt = (
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg_result = await db.execute(last_msg_stmt)
        last_msg = last_msg_result.scalar_one_or_none()

        last_msg_out = None
        if last_msg:
            last_msg_out = MessageOut(
                id=last_msg.id,
                sender_id=last_msg.sender_id,
                content=_decrypt_message(last_msg),
                created_at=last_msg.created_at,
                is_deleted=last_msg.is_deleted,
                is_mine=last_msg.sender_id == user_id,
            )

        # Mensajes no leídos
        unread_count = 0
        if my_participant and my_participant.last_read_at:
            count_stmt = (
                select(func.count())
                .where(
                    and_(
                        Message.conversation_id == conv.id,
                        Message.created_at > my_participant.last_read_at,
                        Message.sender_id != user_id,
                        Message.is_deleted.is_(False),
                    )
                )
            )
            count_result = await db.execute(count_stmt)
            unread_count = count_result.scalar_one() or 0
        elif my_participant and not my_participant.last_read_at:
            # Nunca ha leído: contar todos los mensajes del otro
            count_stmt = (
                select(func.count())
                .where(
                    and_(
                        Message.conversation_id == conv.id,
                        Message.sender_id != user_id,
                        Message.is_deleted.is_(False),
                    )
                )
            )
            count_result = await db.execute(count_stmt)
            unread_count = count_result.scalar_one() or 0

        output.append(
            ConversationOut(
                id=conv.id,
                other_user=participant_out,
                last_message=last_msg_out,
                unread_count=unread_count,
                updated_at=conv.updated_at,
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

    # Invertir para mostrar del más antiguo al más reciente
    rows = list(reversed(rows))

    messages_out = [
        MessageOut(
            id=m.id,
            sender_id=m.sender_id,
            content=_decrypt_message(m),
            created_at=m.created_at,
            is_deleted=m.is_deleted,
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

    return MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        content=content,
        created_at=msg.created_at,
        is_deleted=msg.is_deleted,
        is_mine=True,
    )


async def mark_as_read(db: AsyncSession, conv_id: int, user_id: int) -> None:
    participant = await _get_participant_or_403(db, conv_id, user_id)
    now = datetime.now(timezone.utc)
    # Solo actualizar si el nuevo valor es más reciente
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


async def mark_offline(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(User).where(User.id == user_id).values(last_seen_at=None)
    )
    await db.commit()


async def update_last_seen(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(last_seen_at=func.now())
    )
    await db.commit()
