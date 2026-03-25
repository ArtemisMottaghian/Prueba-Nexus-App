from enum import Enum
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime
from pydantic import model_validator

class CandidateStatus(str, Enum):
    active = "active"
    passive = "passive"
    hired_elsewhere = "hired_elsewhere"
    blacklisted = "blacklisted"

# Esquema Base: Contiene los campos comunes que se repiten
class CandidateBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr # valida formato de correo
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    cv_url: Optional[str] = None
    skills: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[CandidateStatus] = CandidateStatus.active


class CandidateCreate(CandidateBase):
    pass 

# Actualización 
class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    cv_url: Optional[str] = None
    skills: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[CandidateStatus] = None

# Salida (CandidateOut / CandidateResponse)
class CandidateOut(CandidateBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CandidateStatusOut(BaseModel):
    id: int
    status: str

class CandidateFrontendOut(BaseModel):
    id: int
    name: str
    specialty: str
    location: str
    status: str
    source: str
    experience: str
    isAvailable: bool
    time: str

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def map_db_to_frontend(cls, data):
        # Si 'data' es un objeto de la base de datos (SQLAlchemy)
        if hasattr(data, "id") and hasattr(data, "first_name"):
            return {
                "id": data.id,
                "name": f"{data.first_name} {data.last_name}",
                "specialty": data.skills or "Sin especificar",
                "location": data.location or "Sin especificar", 
                "source": data.source or "Directo",             
                "experience": data.experience or "No definida",
                "status": data.status.value if data.status else "active",
                "isAvailable": data.status.value in ["active", "passive"] if data.status else True,
                "time": data.created_at.strftime("%Y-%m-%d") if data.created_at else ""
            }
        return data

class CandidateStatusUpdate(BaseModel):
    """Esquema específico para el endpoint PATCH"""
    status: CandidateStatus