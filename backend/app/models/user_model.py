from sqlalchemy import Column, Integer, String
# IMPORTANTE: Importamos el Enum nativo de SQLAlchemy para PostgreSQL
from sqlalchemy.dialects.postgresql import ENUM 
from db.connection import Base
# Importamos la clase Enum que tú creaste en Pydantic
from schemas.services_schemas import UserType 

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # EL CAMBIO ESTÁ AQUÍ:
    # Le decimos que es un Enum, pasamos tu clase UserType, 
    # y le damos el nombre exacto ("user_role") que tiene en tu base de datos.
    role = Column(
        ENUM(UserType, name="user_role", create_type=False), 
        nullable=False
    )