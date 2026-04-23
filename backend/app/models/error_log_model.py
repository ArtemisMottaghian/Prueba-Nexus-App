from sqlalchemy import Column, BigInteger, String, Boolean, Text, TIMESTAMP
from app.db.base import Base
from sqlalchemy.sql import func

class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    error_code = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    occurred_at = Column(TIMESTAMP(timezone=True), server_default=func.now())