from sqlalchemy import Column, ForeignKey, String, BigInteger, Text, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM
from app.db.base import Base
from app.schemas.candidates_schemas import CandidateStatus 


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(BigInteger, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    is_favourite = Column("is_favorite",Boolean, default=False)
    email = Column(String(255), unique=True, nullable=False, index=True) 
    location = Column(String(255), nullable=True)
    source = Column(String(100), nullable=True)
    experience = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    candidate_url = Column(Text, nullable=True)
    cv_url = Column(Text, nullable=True)
    skills = Column(Text, nullable=True, index=True) 

    status = Column(
        ENUM(CandidateStatus, name="candidate_status", create_type=True),
        server_default="active",
        nullable=True,
        index=True 
    )

    verified = Column(Boolean, default=False, nullable=False)

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

class CandidateComment(Base):
    __tablename__ = 'candidate_comments'

    id = Column(BigInteger, primary_key=True, index=True)
    candidate_id = Column(BigInteger, ForeignKey('candidates.id', ondelete='CASCADE'))
    user_id = Column(BigInteger, ForeignKey('users.id')) # El reclutador que deja la nota
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
