from sqlalchemy import Column, BigInteger, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM
from app.db.connection import Base
from app.schemas.candidates_schemas import CandidateStatus

class CandidateStatusHistory(Base):
    """
       Registra el historial de cambios de estado de los candidatos.
       Cada vez que un candidato cambia de estado (ej: active -> hired_elsewhere),
       se guarda un registro con el estado anterior, el nuevo y quién lo cambió.
       """

    __tablename__ = "candidate_status_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    candidate_id = Column(BigInteger, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    previous_status = Column(ENUM(CandidateStatus, name="candidate_status", create_type=False), nullable=True)
    new_status = Column(ENUM(CandidateStatus, name="candidate_status", create_type=False), nullable=True)
    changed_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    comments = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", backref="status_history")
    user = relationship("User", foreign_keys=[changed_by])