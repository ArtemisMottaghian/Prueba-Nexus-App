from pydantic import BaseModel, Field
from enum import Enum

#Tipos usuarios
class UserType(str, Enum):
    admin = "admin"
    company = "company"
    hr_manager = "hr_manager"

# Schema crear usuario
class NewUser(BaseModel):
    email: str = Field(max_length=255, description="Correo electrónico del usuario")
    password_hash: str = Field(max_length=255, description="Hash de la contraseña del usuario")
    role: UserType = Field(default=UserType.hr_manager, description="Rol del usuario")

# Schema respuesta usuario
class UserResponse(BaseModel):
    id: int
    email: str
    role: UserType

    class Config:
        from_attributes = True # Permite leer el objeto de SQLAlchemy