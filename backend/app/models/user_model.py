from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import ENUM
from app.db.connection import Base
from app.schemas.users_schemas import UserType

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    role = Column(
    ENUM(UserType, name="user_role", create_type=False),
    nullable=False
    )