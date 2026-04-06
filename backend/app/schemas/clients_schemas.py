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
    title: str = Field(..., alias="titulo")
    status: str = Field(..., alias="estado")
    date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


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
    phone: Optional[str] = None


class ClientUpdate(BaseModel):
    """PATCH: todos los campos opcionales."""
    company_name: Optional[str] = None
    sector: Optional[str] = None
    primary_contact: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    cif: Optional[str] = None
    address: Optional[str] = None
    source_id: Optional[int] = None # Añadido por coherencia
    original_offer_id: Optional[int] = None # Añadido por coherencia
    lead_status: Optional[LeadStatus] = None

class ClientOut(ClientBase): # <--- HEREDA
    """Respuesta estándar de lista y creación/edición."""
    id: int
    open_vacancies: int = Field(0, alias="vacantes_abiertas")

    # Crucial: from_attributes=True permite leer de la base de datos
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ClientDetailOut(ClientOut):
    """Respuesta extendida con lista de vacantes para el detalle."""
    positions: List[VacancyOut] = Field([], alias="vacantes")


