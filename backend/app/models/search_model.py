from app.db.base import Base

from sqlalchemy import (
    Column,
    String,
    ForeignKey,
    DateTime,
    Text,
    BigInteger
)

from sqlalchemy.orm import relationship

class Search(Base):
    __tablename__ = "searches"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"))
    raw_query = Column(Text, nullable=False)
    ai_query = Column(Text)
    province = Column(String(100))
    status = Column(String(50), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="searches")
    results = relationship(
        "SearchResult", back_populates="search", cascade="all, delete-orphan"
    )

class SearchResult(Base):
    __tablename__ = "search_results"

    id = Column(BigInteger, primary_key=True, index=True)
    search_id = Column(BigInteger, ForeignKey("searches.id", ondelete="CASCADE"))
    offer_id = Column(BigInteger, ForeignKey("job_offers.id", ondelete="CASCADE"))

    search = relationship("Search", back_populates="results")
    offer = relationship("JobOffer", back_populates="search_matches")

