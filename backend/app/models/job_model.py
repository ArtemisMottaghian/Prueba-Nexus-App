from sqlalchemy import Column, Integer, String, BigInteger, Text, DateTime, ForeignKey, CheckConstraint, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ENUM
from app.db.connection import Base
from app.schemas.job_offer import OfferStatus 

class JobOffer(Base):
    __tablename__ = "job_offers"

    id = Column(BigInteger, primary_key=True, index=True)
    portal_id = Column(Integer, nullable=False) 
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
        ENUM(OfferStatus, name="offer_status", create_type=False),
        default=OfferStatus.detected
    )
    
    priority = Column(Integer, default=3)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint('salary_min <= salary_max', name='check_salary_range'),
        UniqueConstraint('portal_id', 'external_id', name='unique_offer_per_portal'),
    )