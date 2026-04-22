import enum
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

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    comments = relationship("CompanyComment", back_populates="comments")
    managed_by_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", foreign_keys=[managed_by_id])

class CompanyComment(Base):
    __tablename__= 'company_comments'

    id = Column(BigInteger, primary_ket=True, index=True)
    company_id = Column(BigInteger, ForeignKey('companies.id', ondelete='CASCADE'))
    user_id = Column(BigInteger, ForeignKey('users.id'))
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )