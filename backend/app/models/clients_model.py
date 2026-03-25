from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship
from app.db.connection import Base
from app.schemas.clients_schemas import EntityType, LeadStatus


class Client(Base):
    __tablename__ = "clients"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), unique=True, nullable=True)
    source_id = Column(Integer, ForeignKey("job_portals.id"), index=True, nullable=True)
    original_offer_id = Column(BigInteger, ForeignKey("job_offers.id"), nullable=True)
    company_name = Column(String(255), nullable=False, index=True)
    sector = Column(String(255), nullable=True)
    cif = Column(String(20), nullable=True)
    direccion = Column(String(500), nullable=True)
    entity_type = Column(
        ENUM(EntityType, name="entity_type", create_type=False),
        nullable=True
    )
    lead_status = Column(
        ENUM(LeadStatus, name="lead_status", create_type=False),
        nullable=True,
        index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    contacts = relationship("Contact", back_populates="client", lazy="select")
    job_offers_linked = relationship(
        "JobOffer",
        primaryjoin="Client.id == foreign(JobOffer.id)",  # ajusta si tienes FK directa
        lazy="select"
    )