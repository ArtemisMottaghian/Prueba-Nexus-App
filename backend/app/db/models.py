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

class CandidateStatus(str, enum.Enum):
    active = "active"
    passive = "passive"
    hired_elsewhere = "hired_elsewhere"
    blacklisted = "blacklisted"

class ApplicationStatus(str, enum.Enum):
    proposed = "proposed"
    client_interested = "client_interested"
    interviewing = "interviewing"
    offer_sent = "offer_sent"
    hired = "hired"
    rejected_by_client = "rejected_by_client"
    rejected_by_candidate = "rejected_by_candidate"
    pool = "pool"

# Modelos (Tablas)
class User(Base):
    __tablename__= "users"

    id = Column(BigInteger, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(PgEnum(UserRole, name="user_role", create_type=False), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    # 'searches' nos permite acceder a search.user
    searches = relationship("Search", back_populates="user")
    # 'managed_offers" accede a ofertas donde este usuario es el gestor
    managed_offers = relationship("JobOffer", back_populates="manager")
    
    client_profile = relationship("Client", back_populates="user", uselist=False)

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
    status = Column(PgEnum(OfferStatus, name="offer_status", create_type=False), default=OfferStatus.detected, index=True)
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
    
    applications = relationship("JobApplication", back_populates="offer", cascade="all, delete-orphan")

class SearchResult(Base):
    __tablename__ = "search_results"

    id = Column(BigInteger, primary_key=True, index=True)
    search_id = Column(BigInteger, ForeignKey("searches.id", ondelete="CASCADE"))
    offer_id = Column(BigInteger, ForeignKey("job_offers.id", ondelete="CASCADE"))

    search = relationship("Search", back_populates="results")
    offer = relationship("JobOffer", back_populates="search_matches")

class Client(Base):
    __tablename__ = "clients"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), unique=True)
    source_id = Column(Integer, ForeignKey("job_portals.id"))
    original_offer_id = Column(BigInteger, ForeignKey("job_offers.id"))
    company_name = Column(String(255), nullable=False, index=True)
    entity_type = Column(PgEnum(EntityType, name="entity_type", create_type=False))
    lead_status = Column(PgEnum(LeadStatus, name="lead_status", create_type=False), index=True)
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
    linkedin_url = Column(String(255))
    last_interaction = Column(DateTime(timezone=True))

    client = relationship("Client", back_populates="contacts")

class TrackingHistory(Base):
    __tablename__ = "tracking_history"

    id = Column(BigInteger, primary_key=True, index=True)
    client_id = Column(BigInteger, ForeignKey("clients.id", ondelete="CASCADE"))
    offer_id = Column(BigInteger, ForeignKey("job_offers.id"))
    action_type = Column(String(255))
    previous_status = Column(PgEnum(LeadStatus, name="lead_status", create_type=False))
    new_status = Column(PgEnum(LeadStatus, name="lead_status", create_type=False))
    comments = Column(Text)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    client = relationship("Client", back_populates="history")
    offer = relationship("JobOffer", back_populates="tracking_entries")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(BigInteger, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50))
    linkedin_url = Column(String(255))
    cv_url = Column(Text)
    skills = Column(Text) # Puedes guardar "Python, React"
    status = Column(PgEnum(CandidateStatus, name="candidate_status", create_type=False), default=CandidateStatus.active, index=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relación con las aplicaciones
    applications = relationship("JobApplication", back_populates="candidate", cascade="all, delete-orphan")

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(BigInteger, primary_key=True, index=True)
    candidate_id = Column(BigInteger, ForeignKey("candidates.id", ondelete="CASCADE"))
    offer_id = Column(BigInteger, ForeignKey("job_offers.id", ondelete="CASCADE"))
    
    status = Column(PgEnum(ApplicationStatus, name="application_status", create_type=False), default=ApplicationStatus.proposed, index=True)
    feedback = Column(Text)
    
    hired_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Constraints
    __table_args__ = (
        UniqueConstraint('candidate_id', 'offer_id', name='unique_candidate_application'),
    )

    candidate = relationship("Candidate", back_populates="applications")
    
    # AÑADIDO: Relación inversa con ofertas
    offer = relationship("JobOffer", back_populates="applications")

    # AÑADIDO: Relación con entrevistas (Plural)
    interviews = relationship("Interview", back_populates="application", cascade="all, delete-orphan")

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(BigInteger, primary_key=True, index=True)
    application_id = Column(BigInteger, ForeignKey("job_applications.id", ondelete="CASCADE"))
    interviewer_id = Column(BigInteger, ForeignKey("users.id"))
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30)
    meeting_link = Column(Text)
    result = Column(String(50)) # 'passed', 'failed', 'pending'
    feedback = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("JobApplication", back_populates="interviews")
    interviewer = relationship("User")

