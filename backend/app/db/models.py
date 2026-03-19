import enum
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey,
    DateTime, Text, BigInteger, Enum as PgEnum,
    CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

# Definicion de ENUMS
class UserRole(str, enum.Enum):
    admin = "admin"
    company = "company"
    hr_manager = "hr_manager"

class OfferStatus(str, enum.Enum):
    detected = "detected"
    contacted = "contacted"
    negotiating = "negotiating"
    discarded = "discarded"
    won = "won"

class LeadStatus(str, enum.Enum):
    new = "new"
    qualifying = "qualifying"
    negotiating = "negotiating"
    converted = "converted"
    lost = "lost"

class EntityType(str, enum.Enum):
    scraping_prospect = "scraping_prospect"
    confirmed_client = "confirmed_client"


# Modelos (Tablas)
class User(Base):
    __tablename__= "users"

    id = Column(BigInteger, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(PgEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    # 'searches' nos permite acceder a search.user
    searches = relationship("Search", back_populates="user")
    # 'managed_offers" accede a ofertas donde este usuario es el gestor
    managed_offers = relationship("JobOffer", back_populates="manager")
    # Relacion 1 a 1 con Clients (si aplica)
    client_profile = relationship("Client", back_populates="manager")

class JobPortal(Base):
    __tablename__= "job_portals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    base_url = Column(String(255))
    is_active = Column(Boolean, default=True)

    offers = relationship("JobOffer", back_populates="portal")
    clients = relationship("Client", back_populates="source_portal")

class Search(Base):
    __tablename__ = "searches"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"))
    raw_query = Column(Text, nullable=False)
    ai_query = Column(Text)
    province = Column(String(100))
    status = Column(String(50), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="searches")
    results = relationship("SearchResult", back_populates="search", cascade="all, delete-orphan")

