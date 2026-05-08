from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.db.base import Base

class CandidatePortal(Base):
    __tablename__ = "candidate_portals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_run_status = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)