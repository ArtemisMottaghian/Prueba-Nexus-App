from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey
from sqlalchemy.orm import relationship  
from app.db.base import Base

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(BigInteger, primary_key=True, index=True)
    client_id = Column(BigInteger, ForeignKey("clients.id", ondelete="CASCADE"))
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"))
    full_name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    job_title = Column(String(100))
    linkedin_url = Column(String(255), nullable=True)
    last_interaction = Column(DateTime(timezone=True))

    client = relationship("Client", back_populates="contacts")
    company = relationship("Company", back_populates="contacts")