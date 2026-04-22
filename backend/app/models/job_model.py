from sqlalchemy import Column, Integer, String, BigInteger, Text, ForeignKey, CheckConstraint, UniqueConstraint,DateTime, Enum as PgEnum, func,Boolean
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.schemas.job_offer import OfferStatus
from app.models.aplication_model import ApplicationStatus
from app.models.candidates_model import Candidate
from app.models.user_model import User
from app.models.search_model import Search
#from app.models.interviews_model import Interview

class JobPortal(Base):
    __tablename__ = "job_portals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    base_url = Column(String(255))
    is_active = Column(Boolean, default=True)

    offers = relationship("JobOffer", back_populates="portal")
    clients = relationship("Client", back_populates="source_portal")

class JobOffer(Base):
    __tablename__ = "job_offers"

    id = Column(BigInteger, primary_key=True, index=True)
    portal_id = Column(Integer, ForeignKey("job_portals.id"))   
    managed_by_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    external_id = Column(String(255), nullable=True)
    title = Column(String(255), nullable=False)
    company_name = Column(String(255))
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

    status = Column(
        ENUM(OfferStatus, name="offer_status", create_type=True),
        default=OfferStatus.detected
    )

    priority = Column(Integer, default=3)
    is_favorite = Column(Boolean, default=False)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(),server_default=func.now())
    portal = relationship("JobPortal", back_populates="offers")
    applications = relationship("JobApplication", back_populates="offer")
    related_client = relationship("Client", back_populates="original_offer", uselist=False)
    manager = relationship("User", back_populates="managed_offers", foreign_keys=[managed_by_id])
    tracking_entries = relationship("TrackingHistory", back_populates="offer", cascade="all, delete-orphan")
    search_matches = relationship("SearchResult", back_populates="offer", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint('salary_min <= salary_max', name='check_salary_range'),
        UniqueConstraint('portal_id', 'external_id', name='unique_offer_per_portal'),
    )

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(BigInteger, primary_key=True, index=True)
    candidate_id = Column(BigInteger, ForeignKey("candidates.id", ondelete="CASCADE"))
    offer_id = Column(BigInteger, ForeignKey("job_offers.id", ondelete="CASCADE"))

    status = Column(
        PgEnum(ApplicationStatus, name="application_status", create_type=False),
        default=ApplicationStatus.proposed,
        index=True,
    )
    feedback = Column(Text)

    hired_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "candidate_id", "offer_id", name="unique_candidate_application"
        ),
    )

    candidate = relationship("Candidate", back_populates="applications")

    offer = relationship("JobOffer", back_populates="applications")

    #interviews = relationship(
   #     "Interview", back_populates="application", cascade="all, delete-orphan"
    #)