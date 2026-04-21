from enum import Enum
from pydantic import BaseModel, ConfigDict,EmailStr, Field
from typing import Optional, List
from datetime import datetime


class LeadStatus(str, Enum):
    new = "new"
    qualifying = "qualifying"
    negotiating = "negotiating"
    converted = "converted"
    lost = "lost"


class EntityType(str, Enum):
    scraping_prospect = "scraping_prospect"
    confirmed_client = "confirmed_client"


# --- Schemas de Vacante (Para cuando listamos vacantes dentro de un cliente)) ---

class VacancyOut(BaseModel):
    id: int
    title: str
    status: str
    date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Schemas de Cliente ---

class ClientBase(BaseModel):
    """
    El molde Padre.
    Aquí ponemos lo que un cliente SIEMPRE tiene.
    """
    company_name: str = Field(..., min_length=2, max_length=100)
    sector: Optional[str] = Field(None, max_length=50)
    cif: Optional[str] = Field(None, min_length=8, max_length=9)
    address: Optional[str] = Field(None, max_length=200)
    source_id: Optional[int] = None
    original_offer_id: Optional[int] = None
    entity_type: Optional[EntityType] = EntityType.scraping_prospect
    lead_status: Optional[LeadStatus] = LeadStatus.new


class ClientCreate(ClientBase):
    """
    PASO 2: Esquema para CREAR.
    Hereda todo lo de arriba y añade datos de contacto.
    """
    primary_contact: Optional[str] = Field(None, min_length=3)
    email: Optional[EmailStr] = None # Valida que sea un email real
    phone: Optional[str] =  Field(None, pattern=r'^\+?[\d\s\-]{7,20}$')


class ClientUpdate(BaseModel):
    """PATCH: todos los campos opcionales."""
    company_name: Optional[str] = None
    sector: Optional[str] = None
    primary_contact: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s\-]{7,20}$')
    cif: Optional[str] = Field(None, min_length=8, max_length=9)
    address: Optional[str] = None
    source_id: Optional[int] = None # Añadido por coherencia
    original_offer_id: Optional[int] = None # Añadido por coherencia
    lead_status: Optional[LeadStatus] = None

class ClientOut(ClientBase): # <--- HEREDA
    """Respuesta estándar de lista y creación/edición."""
    id: int
    open_vacancies: int = 0

    # Crucial: from_attributes=True permite leer de la base de datos
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ClientDetailOut(ClientOut):
    """Respuesta extendida con lista de vacantes para el detalle."""
    positions: List[VacancyOut] = []

class MessageResponse(BaseModel):
    message: str

class ContactOut(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    candidate_url: Optional[str] = None
    last_interaction: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)