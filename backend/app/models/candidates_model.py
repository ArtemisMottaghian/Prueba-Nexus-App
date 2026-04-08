from sqlalchemy import Column, String, BigInteger, Text, DateTime, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM
from app.db.connection import Base
from app.schemas.candidates_schemas import CandidateStatus 


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(BigInteger, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True) 
    location = Column(String(255), nullable=True)
    source = Column(String(100), nullable=True)
    experience = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    linkedin_url = Column(String(255), nullable=True)
    cv_url = Column(Text, nullable=True)
    skills = Column(Text, nullable=True, index=True) 
    
    status = Column(
        ENUM(CandidateStatus, name="candidate_status", create_type=True),
        server_default="active",
        nullable=True,
        index=True 
    )
    
    notes = Column(Text, nullable=True)
    
    created_at = Column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    
    updated_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )

    applications = relationship("JobApplication", back_populates="candidate")
