from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class LeadStatus(str, Enum):
    new = "new"
    contacted = "contacted"
    in_progress = "in_progress"
    negotiating = "negotiating"
    discarded = "discarded"
    converted = "converted"


class CompanyBase(BaseModel):
    name: str = Field(..., max_length=255, description="Nombre de la empresa")
    cif: Optional[str] = Field(None, max_length=50)
    sector: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    linkedin_url: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    lead_status: LeadStatus = Field(default=LeadStatus.new)
    source_id: Optional[int] = None
    original_offer_id: Optional[int] = None
    notes: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CompanyAssignRequest(BaseModel):
    user_id: int = Field(
        ..., description="ID del usuario (rol 'company') al que se asignan las empresas"
    )
    company_ids: List[int] = Field(
        ..., description="Lista de IDs de las empresas a asignar"
    )
