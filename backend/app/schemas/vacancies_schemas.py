from datetime import datetime
from typing import Optional, List,Literal
from pydantic import BaseModel, ConfigDict,Field,field_validator,HttpUrl
from app.schemas.job_offer import OfferStatus


# Schema base para la tarjeta (Dashboard y Lista)
class VacancySummary(BaseModel):
    id: int
    title: str = Field(..., min_length=3, max_length=255)  # Obligatorio, entre 3 y 255 caracteres
    company_name: Optional[str] = Field(None, max_length=255)  # Opcional, max 255 caracteres
    location: Optional[str] = None
    salary_min: Optional[int] = Field(None, ge=0)  # No puede ser negativo
    salary_max: Optional[int] = Field(None, ge=0)  # No puede ser negativo
    published_at: Optional[datetime] = None
    portal_id: Optional[int] = None
    status: OfferStatus

    model_config = ConfigDict(from_attributes=True)

    @field_validator('salary_max')
    @classmethod
    def salary_max_must_be_greater(cls, v, info):
        # El salario máximo no puede ser menor que el mínimo
        if v is not None and info.data.get('salary_min') is not None:
            if v < info.data['salary_min']:
                raise ValueError('salary_max must be greater than salary_min')
        return v



# Schema extendido para el detalle
# Hereda del resumen y le añade el resto de campos
class VacancyDetail(VacancySummary):
    location: Optional[str] = Field(None, max_length=255)
    offer_url: Optional[HttpUrl] = None  # Valida que sea una URL válida con http:// o https://
    job_description: Optional[str] = Field(None, max_length=5000)
    company_description: Optional[str] = Field(None, max_length=2000)
    contract_type: Optional[str] = Field(None, max_length=50)
    work_modality: Optional[str] = Field(None, max_length=50)
    sector: Optional[str] = Field(None, max_length=255)
    portal_id: Optional[int] = None

# Schema para vacantes filtradas
class VacancyFiltered(VacancySummary):
    location: Optional[str] = None
    sector: Optional[str] = None

# Schema para marcar como favorita
class FavoriteRequest(BaseModel):
    favorite: bool

# Schema para acciones masivas
class BulkActionRequest(BaseModel):
    vacancy_ids: List[int] = Field(..., min_length=1)  # Al menos una vacante
    action: Literal["discard","delete"]  # Acción a aplicar

# Schema para respuestas de mensaje
class MessageResponse(BaseModel):
    message: str