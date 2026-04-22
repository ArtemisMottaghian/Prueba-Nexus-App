from sqlalchemy import Column, String, BigInteger, ForeignKey, DateTime, Text, Enum as PgEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.connection import Base
from app.models.leadStatus_model import LeadStatus


class TrackingHistory(Base):
    __tablename__ = "tracking_history"

    id = Column(BigInteger, primary_key=True, index=True)
    client_id = Column(BigInteger, ForeignKey("clients.id", ondelete="CASCADE"))
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    offer_id = Column(BigInteger, ForeignKey("job_offers.id"))
    action_type = Column(String(255))
    previous_status = Column(PgEnum(LeadStatus, name="lead_status", create_type=False))
    new_status = Column(PgEnum(LeadStatus, name="lead_status", create_type=False))
    comments = Column(Text)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    client = relationship("Client", back_populates="history")
    company = relationship("Company", back_populates="tracking_history")
    offer = relationship("JobOffer", back_populates="tracking_entries")

