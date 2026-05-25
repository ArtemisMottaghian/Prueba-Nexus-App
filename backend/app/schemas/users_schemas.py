from pydantic import BaseModel, Field, EmailStr, ConfigDict
from enum import Enum
from typing import Optional
from datetime import datetime

#Tipos usuarios
class UserType(str, Enum):
    admin = "admin"
    company = "company"
    hr_manager = "hr_manager"

# Schema crear usuario
class NewUser(BaseModel):
    email: EmailStr = Field(..., max_length=255, description="Correo electrónico del usuario")  # Valida formato email
    name: Optional[str] = None
    password: str = Field(..., min_length=8, max_length=255, description="Contraseña del usuario") # Mínimo 8 caracteres
    role: UserType = Field(default=UserType.hr_manager, description="Rol del usuario")

# Schema para actualizar usuario (todos los campos opcionales)
class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=255)
    role: Optional[UserType] = None


# Schema respuesta usuario
class UserResponse(BaseModel):
    id: int
    name: Optional[str] = None
    email: EmailStr
    role: UserType
    created_at: Optional[datetime] = None
    email_notifications: bool = False

    model_config = ConfigDict(from_attributes=True)


class NotificationPrefsUpdate(BaseModel):
    email_notifications: bool

class MessageResponse(BaseModel):
    message: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=255)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=255)