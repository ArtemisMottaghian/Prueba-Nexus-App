from pydantic import BaseModel, ConfigDict, HttpUrl, Field, model_validator
from typing import Optional
from datetime import datetime
import enum

class OfferStatus(str, enum.Enum):
    detected = 'detected'
    contacted = 'contacted'
    negotiating = 'negotiating'
    discarded = 'discarded'
    won = 'won'


class JobOfferBase(BaseModel):
    title: str = Field(..., max_length=255, description="Título oficial del puesto")
    company_name: Optional[str] = Field(
        default=None, max_length=255, description="Nombre de la empresa"
    )
    location: Optional[str] = Field(
        default=None, max_length=255, description="Ubicación geográfica"
    )
    offer_url: Optional[HttpUrl] = Field(
        default=None, description="Enlace directo a la oferta"
    )

    job_description: Optional[str] = Field(
        default=None, description="Responsabilidades y requisitos"
    )
    company_description: Optional[str] = Field(
        default=None, description="Sobre la empresa contratante"
    )

    published_at: Optional[datetime] = Field(
        default=None, description="Fecha original de publicación"
    )
    sector: Optional[str] = Field(
        default=None, max_length=255, description="Sector o categoría"
    )

    salary_min: Optional[int] = Field(
        default=None, description="Límite inferior del salario"
    )
    salary_max: Optional[int] = Field(
        default=None, description="Límite superior del salario"
    )
    contract_type: Optional[str] = Field(
        default=None, max_length=50, description="Tipo de contrato"
    )
    contract_time: Optional[str] = Field(
        default=None, max_length=50, description="Jornada laboral"
    )
    work_modality: Optional[str] = Field(
        default=None, max_length=50, description="Ej. 100% Remoto, Híbrido"
    )

    status: OfferStatus = Field(
        default=OfferStatus.detected, description="Estado en el embudo"
    )
    priority: int = Field(default=3, ge=1, le=5, description="Prioridad (1-5)")

    # La validación vive en la Base para que proteja tanto al crear como al actualizar
    @model_validator(mode="after")
    def validar_rango_salarial(self) -> "JobOfferBase":
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError(
                    "Error lógico: El salario mínimo no puede ser mayor que el máximo"
                )
        return self


class JobOfferRequest(JobOfferBase):
    portal_id: int = Field(
        ..., description="ID interno del portal (1=Adzuna, 2=InfoJobs)"
    )
    external_id: str = Field(
        ..., max_length=255, description="ID único del portal de origen"
    )
    managed_by_id: Optional[int] = Field(
        default=None, description="ID del usuario asignado"
    )


class JobOfferResponse(JobOfferRequest):
    id: int = Field(..., description="ID interno en nuestra base de datos")
    scraped_at: datetime = Field(..., description="Cuándo extrajimos la oferta")
    updated_at: Optional[datetime] = Field(
        default=None, description="Última modificación"
    )

    model_config = ConfigDict(from_attributes=True)

class ScrapedJobOffer(JobOfferRequest):
    """
    Esquema que se utiliza en el orchestrator.py.
    Contiene todos los datos de la oferta, más los datos del reclutador.
    """
    recruiter_name: Optional[str] = Field(
        default=None, description="Nombre extraído por el scraper crudo."
    )

    recruiter_email: Optional[str] = Field(
        default=None, description="Email extraído."
    )