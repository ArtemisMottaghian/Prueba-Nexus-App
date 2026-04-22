from app.schemas.companies_schemas import OfferStatus
from pydantic import BaseModel,Field
from typing import Optional

class CompanyBase(BaseModel):
    name: str = Field(..., max_length=255, description="Nombre de la empresa")

    company_descrption: Optional[str] = Field(
        default=None, description="Descripción de la empresa"
    )

    cif: Optional[str] = Field(
        default = None, max_lenght=50, description="CIF de la empresa"
    )

    sector: Optional[str] = Field(
        default = None, max_lenght=255, description="Sector al que se dedica la empresa"
    )

    website: Optional[str] = Field(
        default = None, max_lenght=255, description="Página web de la empresa"
    )

    linkedin_url: Optional[str] = Field(
        default = None, max_lenght=255, description="URL del LinkedIn de la empresa"
    )

    address: Optional[str] = Field(
        default = None, max_lenght=500, description="Dirección de la empresa"
    )

    lead_status: OfferStatus = Field(
        default=OfferStatus.detected, description="Estado de la empresa"
    )

    source_id: Optional[int] = Field(
        default = None, max_lenght=50, description="CIF de la empresa"
    )

    original_offer_id: Optional[int] = Field(
        default = None, description="Oferta original de la empresa"
    )

    notes: Optional[str] = Field(
        default = None, description="Notas sobre de la empresa"
    )

    recruiter_name: Optional[str] = Field(
        default = None, max_lenght=100, description="Nombre de la persona de contacto"
    )

    recruiter_lastname: Optional[str] = Field(
        default = None, max_lenght=100, description="Apellido de la persona de contacto"
    )

    recruiter_email: Optional[str] = Field(
        default = None, max_lenght=255, description="Email de la persona de contacto"
    )

    recruiter_phone: Optional[str] = Field(
        default = None, max_lenght=20, description="Teléfono de la persona de contacto"
    )

