from enum import Enum
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime

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