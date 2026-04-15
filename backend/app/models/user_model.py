import enum
from sqlalchemy import Column, String, Boolean, DateTime, BigInteger, Enum as PgEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.connection import Base

class UserRole(str, enum.Enum):
    admin = "admin"
    company = "company"
    hr_manager = "hr_manager"

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(PgEnum(UserRole, name="user_role", create_type=False), nullable=False)
    is_active = Column(Boolean, default=True)
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relaciones
    # 'searches' nos permite acceder a search.user
    searches = relationship("Search", back_populates="user")
    # 'managed_offers" accede a ofertas donde este usuario es el gestor
    managed_offers = relationship("JobOffer", back_populates="manager")

    client_profile = relationship("Client", back_populates="user", uselist=False)


