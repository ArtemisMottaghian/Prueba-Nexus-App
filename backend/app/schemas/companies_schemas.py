from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# ── Enum de estados comerciales ───────────────────────────────────────────────
# Refleja el ciclo de vida de una empresa en el pipeline comercial.
# Acordado en reunión de negocio del 16 de abril de 2026.
class LeadStatus(str, Enum):
    new = "new" # Detectada por el scraper, sin contacto aún
    contacted = "contacted"  # Se ha iniciado contacto
    in_progress = "in_progress" # En proceso de negociación inicial
    negotiating = "negotiating" # Negociando condiciones
    discarded = "discarded"  # Descartada, no interesa
    converted = "converted" # Firmada, pasa a ser cliente

# Campos comunes compartidos por Create y Response.
class CompanyBase(BaseModel):
    name: str = Field(..., max_length=255, description="Nombre de la empresa")
    primary_contact: Optional[str] = Field(None, max_length=255)
    cif: Optional[str] = Field(None, max_length=50)
    sector: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    linkedin_url: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    lead_status: LeadStatus = Field(default=LeadStatus.new)
    source_id: Optional[int] = None  # Portal de origen (InfoJobs, LinkedIn...)
    original_offer_id: Optional[int] = None # Vacante que originó el contacto
    notes: Optional[str] = None
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    entity_type: Optional[str] = None


# ── Schema de Creación
# Hereda todo de CompanyBase. Se usa en POST /api/companies.
class CompanyCreate(CompanyBase):
    pass

# ── Schema de Actualización ───────────────────────────────────────────────────
# Todos los campos opcionales para PATCH /api/companies/{id}.
class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    primary_contact: Optional[str] = Field(None, max_length=255)
    cif: Optional[str] = Field(None, max_length=50)
    sector: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    linkedin_url: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    lead_status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    entity_type: Optional[str] = None
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)



# ── Schema de Respuesta ───────────────────────────────────────────────────────
# Extiende CompanyBase añadiendo campos generados por la BD.
# Se usa en las respuestas de GET, POST y PATCH.
class CompanyResponse(CompanyBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # from_attributes=True permite leer directamente del modelo SQLAlchemy
    model_config = ConfigDict(from_attributes=True)


# ── Schema de Asignación masiva ───────────────────────────────────────────────
# Se usa en POST /api/companies/assign-user para asignar
# varias empresas a un usuario con rol 'company'.
class CompanyAssignRequest(BaseModel):
    user_id: int = Field(
        ..., description="ID del usuario (rol 'company') al que se asignan las empresas"
    )
    company_ids: List[int] = Field(
        ..., description="Lista de IDs de las empresas a asignar"
    )

# Devuelve el manager de la empresa
class CompanyWithManagerResponse(CompanyResponse):
    managed_by_id: Optional[int] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None


# Documento adjunto de una empresa (contrato, propuesta, factura...)
class CompanyDocumentOut(BaseModel):
    id: int
    tipo: str
    original_name: str
    size_bytes: Optional[int] = None
    uploaded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)