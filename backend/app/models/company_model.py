from dataclasses import Field
import enum
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    BigInteger,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    Enum,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    interested = "interested"
    not_interested = "not_interested"
    converted = "converted"


class Company(Base):
    __tablename__ = "companies"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_description = Column(Text)
    cif = Column(String(50))
    sector = Column(String(255))
    website = Column(String(255))
    linkedin_url = Column(String(255))
    address = Column(String(500))

    lead_status = Column(
        Enum(LeadStatus, name="lead_status"), server_default=LeadStatus.new.value
    )

    source_id = Column(Integer, ForeignKey("job_portals.id"))
    original_offer_id = Column(BigInteger, ForeignKey("job_offers.id"))

    notes = Column(Text)

    recruiter_name = Column(String(100))
    recruiter_lastname = Column(String(100))
    recruiter_email = Column(String(255))
    recruiter_phone = Column(String(20))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    comments = relationship("ClientComment", back_populates="company")
