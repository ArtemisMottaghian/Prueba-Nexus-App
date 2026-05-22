from sqlalchemy import (
    Column,
    BigInteger,
    ForeignKey,
    DateTime,
    Text,
    Boolean,
    LargeBinary,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(BigInteger, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    participants = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        lazy="raise",
    )
    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at.asc()",
        lazy="raise",
    )


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    conversation_id = Column(
        BigInteger,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_read_at = Column(DateTime(timezone=True), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)

    conversation = relationship("Conversation", back_populates="participants", lazy="raise")
    user = relationship("User", back_populates="conversations", lazy="raise")

    __table_args__ = (
        Index("idx_participants_user_id", "user_id"),
        Index("idx_participants_conversation_id", "conversation_id"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True, index=True)
    conversation_id = Column(
        BigInteger,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    content = Column(Text, nullable=False)
    content_iv = Column(LargeBinary, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    conversation = relationship("Conversation", back_populates="messages", lazy="raise")
    sender = relationship("User", lazy="raise")

    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
    )
