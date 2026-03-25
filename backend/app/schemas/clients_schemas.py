from enum import Enum
from pydantic import BaseModel, ConfigDict
from typing import Optional
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



# 1. Esquema Base: Contiene los campos comunes que se repiten
class ClientBase(BaseModel):
    company_name: str
    source_id: Optional[int] = None
    original_offer_id: Optional[int] = None
    entity_type: Optional[EntityType] = None
    lead_status: Optional[LeadStatus] = LeadStatus.new

# 2. Esquema de Creación ()
class ClientCreate(ClientBase):
    pass # Usa exactamente los mismos campos que ClientBase

# 3. Esquema de Actualización (ClientUpdate)
class ClientUpdate(BaseModel):
    # En un Update (PATCH), todos los campos deben ser opcionales
    # porque el usuario podría querer actualizar solo uno de ellos.
    company_name: Optional[str] = None
    source_id: Optional[int] = None
    original_offer_id: Optional[int] = None
    entity_type: Optional[EntityType] = None
    lead_status: Optional[LeadStatus] = None

# 4. Esquema de Salida (ClientOut / ClientResponse)
class ClientOut(ClientBase):
    # Añadimos los campos que genera la base de datos automáticamente
    id: int
    user_id: Optional[int] = None
    updated_at: Optional[datetime] = None

    # Configuración CLAVE para Pydantic V2: 
    # Permite leer los datos directamente del modelo SQLAlchemy (antes orm_mode = True)
    model_config = ConfigDict(from_attributes=True)