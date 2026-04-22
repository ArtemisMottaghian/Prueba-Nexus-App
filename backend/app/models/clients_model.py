from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey,Text, func, Enum as PgEnum
from sqlalchemy.orm import relationship
from app.db.connection import Base
from app.schemas.clients_schemas import EntityType, LeadStatus


class Client(Base):
    __tablename__ = "clients"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), unique=True)
    source_id = Column(Integer, ForeignKey("job_portals.id"))
    original_offer_id = Column(BigInteger, ForeignKey("job_offers.id"))
    company_name = Column(String(255), nullable=False, index=True)
    sector = Column(String(255))
    cif = Column(String(255))
    address = Column("direccion", String(500))
    entity_type = Column(PgEnum(EntityType, name="entity_type", create_type=False))
    lead_status = Column(
        PgEnum(LeadStatus, name="lead_status", create_type=False), index=True
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="client_profile")
    source_portal = relationship("JobPortal", back_populates="clients")
    original_offer = relationship("JobOffer", back_populates="related_client")

    # cascade="all, delete-orphan" significa que si borras el cliente, sus contactos se borran también.
    
    #Hace relacion a contacto cuando debe de ser contacto ->empresa, por eso se comenta
    #contacts = relationship(
    #    "Contact", back_populates="client", cascade="all, delete-orphan"
    #)
    history = relationship(
        "TrackingHistory", back_populates="client", cascade="all, delete-orphan"
    )

class ClientComment(Base):
    __tablename__ = 'client_comments'
    
    id = Column(BigInteger, primary_key=True, index=True)
    client_id = Column(BigInteger, ForeignKey('clients.id', ondelete='CASCADE'))
    user_id = Column(BigInteger, ForeignKey('users.id'))
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
