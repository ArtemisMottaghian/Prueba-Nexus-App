from sqlalchemy import Column, BigInteger, ForeignKey
from app.db.base import Base

class VacancyAssignment(Base):
    __tablename__ = "vacancy_assignments"

    vacancy_id = Column(BigInteger, ForeignKey("job_offers.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)