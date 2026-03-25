from enum import Enum
from pydantic import BaseModel, ConfigDict
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


# --- Schemas de Vacante (para el detalle de cliente) ---

class VacanteOut(BaseModel):
    id: int
    title: str
    status: str
    date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Schemas de Cliente ---

class ClientBase(BaseModel):
    company_name: str
    sector: Optional[str] = None
    cif: Optional[str] = None
    address: Optional[str] = None
    source_id: Optional[int] = None
    original_offer_id: Optional[int] = None
    entity_type: Optional[EntityType] = None
    lead_status: Optional[LeadStatus] = LeadStatus.new


class ClientCreate(BaseModel):
    """Campos que envía el frontend al crear un cliente."""
    company_name: str
    sector: Optional[str] = None
    primary_contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cif: Optional[str] = None
    address: Optional[str] = None


class ClientUpdate(BaseModel):
    """PATCH: todos los campos opcionales."""
    company_name: Optional[str] = None
    sector: Optional[str] = None
    primary_contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cif: Optional[str] = None
    address: Optional[str] = None


class ClientOut(BaseModel):
    """Respuesta estándar de lista y creación/edición."""
    id: int
    company_name: str
    sector: Optional[str] = None
    primary_contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    open_positions: int = 0
    cif: Optional[str] = None
    address: Optional[str] = None

    model_config = ConfigDict(from_attributes=False)


class ClientDetailOut(ClientOut):
    """Respuesta extendida con lista de vacantes para el detalle."""
    positions: List[VacanteOut] = []