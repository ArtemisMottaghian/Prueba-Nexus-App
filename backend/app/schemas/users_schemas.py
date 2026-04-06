from pydantic import BaseModel, Field, EmailStr, ConfigDict
from enum import Enum

#Tipos usuarios
class UserType(str, Enum):
    admin = "admin"
    company = "company"
    hr_manager = "hr_manager"

# Schema crear usuario
class NewUser(BaseModel):
    email: EmailStr = Field(..., max_length=255, description="Correo electrónico del usuario")  # Valida formato email
    password_hash: str = Field(..., min_length=8, max_length=255, description="Hash de la contraseña del usuario") # Mínimo 8 caracteres
    role: UserType = Field(default=UserType.hr_manager, description="Rol del usuario")

# Schema respuesta usuario
class UserResponse(BaseModel):
    id: int
    email: EmailStr # Valida formato email
    role: UserType

    # Permite leer datos directamente desde objetos SQLAlchemy
    model_config = ConfigDict(from_attributes=True)