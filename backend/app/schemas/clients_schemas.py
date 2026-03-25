from enum import Enum
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from typing import List
class LeadStatus(str, Enum):
    new = "new"
    qualifying = "qualifying"
    negotiating = "negotiating"
    converted = "converted"
    lost = "lost"

class EntityType(str, Enum):
    scraping_prospect = "scraping_prospect"
    confirmed_client = "confirmed_client"


# Esquema Base: Contiene los campos comunes que se repiten
class ClientBase(BaseModel):
    company_name: str
    sector: Optional[str] = None
    cif: Optional[str] = None
    direccion: Optional[str] = None
    source_id: Optional[int] = None
    original_offer_id: Optional[int] = None
    entity_type: Optional[EntityType] = None
    lead_status: Optional[LeadStatus] = LeadStatus.new

# Esquema de Creación ()
class ClientCreate(ClientBase):
    """Campos que envia el frontend al crear un cliente"""
    nombre: str
    sector: Optional[str] = None
    contacto_principal: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    cif: Optional[str] = None
    direccion: Optional[str] = None

# Esquema de Actualización (ClientUpdate)
class ClientUpdate(BaseModel):
    # En un Update (PATCH), todos los campos deben ser opcionales
    # porque el usuario podría querer actualizar solo uno de ellos.
    company_name: Optional[str] = None
    source_id: Optional[int] = None
    original_offer_id: Optional[int] = None
    entity_type: Optional[EntityType] = None
    lead_status: Optional[LeadStatus] = None

# Esquema de Salida (ClientOut / ClientResponse)
class ClientOut(ClientBase):
    """Respuesta estándar de lista y creación/edición."""
    id: int
    nombre: str
    sector: Optional[str] = None
    contacto_principal: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    vacantes_abiertas: int = 0
    cif: Optional[str] = None
    direccion: Optional[str] = None

    model_config = ConfigDict(from_attributes=False)  # construido a mano desde el servicio

class ClientDetailOut(ClientOut):
    """ Respuesta exctendida con lista de vacantes para el detalle"""
    vacantes: List[VacanteOut] = []

# Esquema de Vacante (para el detalle de cliente)
class VacanteOut(BaseModel):
    id: int
    titulo: str
    estado: str

    model_config = ConfigDict(from_attributes=True)