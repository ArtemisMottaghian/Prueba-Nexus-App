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

class JobOffer(Base):
    __tablename__ = "job_offers"

    id = Column(BigInteger, primary_key=True, index=True)
    portal_id = Column(Integer, ForeignKey("job_portals.id"))
    managed_by_id = Column(BigInteger, ForeignKey("users.id"))
    external_id = Column(String(255))
    title = Column(String(255), nullable=False, index=True)
    company_name = Column(String(255), index=True)
    location = Column(String(255))
    offer_url = Column(Text)
    job_description = Column(Text)
    company_description = Column(Text)
    published_at = Column(DateTime(timezone=True))
    sector = Column(String(255))
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    contract_type = Column(String(50))
    contract_time = Column(String(50))
    work_modality = Column(String(50))
    status = Column(PgEnum(OfferStatus), default=OfferStatus.detected, index=True)
    priority = Column(Integer, default=3)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint('salary_min <= salary_max', name='check_salary_range'),
        UniqueConstraint('portal_id', 'external_id', name='unique_offer_per_portal'),
    )

    portal = relationship("JobPortal", back_populates="offers")
    manager = relationship("User", back_populates="managed_offers")
    
    # Relación M:N a través de SearchResult
    search_matches = relationship("SearchResult", back_populates="offer")
    
    # Si la oferta se convierte en cliente
    related_client = relationship("Client", back_populates="original_offer", uselist=False)
    
    tracking_entries = relationship("TrackingHistory", back_populates="offer")

class SearchResult(Base):
    __tablename__ = "search_results"

    id = Column(BigInteger, primary_key=True, index=True)
    search_id = Column(BigInteger, ForeignKey("searches.id", ondelete="CASCADE"))
    search_id = Column(BigInteger, ForeignKey("job_offers.id", ondelete="CASCADE"))

    search = relationship("Search", back_populates="results")
    offer = relationship("JobOffer", back_populates="search_matches")

class Client(Base):
    __tablename__ = "clients"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), unique=True)
    source_id = Column(Integer, ForeignKey("job_portals.id"))
    original_offer_id = Column(BigInteger, ForeignKey("job_offers.id"))
    company_name = Column(String(255), nullable=False, index=True)
    entity_type = Column(PgEnum(EntityType))
    lead_status = Column(PgEnum(LeadStatus), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="client_profile")
    source_portal = relationship("JobPortal", back_populates="clients")
    original_offer = relationship("JobOffer", back_populates="related_client")
    
    # cascade="all, delete-orphan" significa que si borras el cliente, sus contactos se borran también.
    contacts = relationship("Contact", back_populates="client", cascade="all, delete-orphan")
    history = relationship("TrackingHistory", back_populates="client", cascade="all, delete-orphan")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(BigInteger, primary_key=True, index=True)
    client_id = Column(BigInteger, ForeignKey("clients.id", ondelete="CASCADE"))
    full_name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    job_title = Column(String(100))
    last_interaction = Column(DateTime(timezone=True))

    client = relationship("Client", back_populates="contacts")

class TrackingHistory(Base):
    __tablename__ = "tracking_history"

    id = Column(BigInteger, primary_key=True, index=True)
    client_id = Column(BigInteger, ForeignKey("clients.id", ondelete="CASCADE"))
    offer_id = Column(BigInteger, ForeignKey("job_offers.id"))
    action_type = Column(String(255))
    previous_status = Column(PgEnum(LeadStatus))
    new_status = Column(PgEnum(LeadStatus))
    comments = Column(Text)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    client = relationship("Client", back_populates="history")
    offer = relationship("JobOffer", back_populates="tracking_entries")
