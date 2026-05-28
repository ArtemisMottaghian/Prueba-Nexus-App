from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from app.db.base import Base

class ScraperKeyword(Base):
    __tablename__ = "scraper_keywords"
    
    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())