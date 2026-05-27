from datetime import datetime
from typing import Optional, List,Literal
from pydantic import BaseModel, ConfigDict,Field,field_validator,model_validator
from app.schemas.job_offer import OfferStatus


# Schema base para la tarjeta (Dashboard y Lista)
class VacancySummary(BaseModel):
    id: int
    title: str = Field(..., min_length=3, max_length=255)  # Obligatorio, entre 3 y 255 caracteres
    company_name: Optional[str] = None  # Opcional
    location: Optional[str] = None
    salary_min: Optional[int] = Field(None, ge=0)  # No puede ser negativo
    salary_max: Optional[int] = Field(None, ge=0)  # No puede ser negativo
    published_at: Optional[datetime] = None
    portal_id: Optional[int] = None
    status: Optional[OfferStatus] = None
    is_favourite: bool = False
    sector: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('is_favourite', mode='before')
    @classmethod
    def coerce_is_favourite(cls, v):
        return bool(v) if v is not None else False

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
    offer_url: Optional[str] = None
    job_description: Optional[str] = Field(None, max_length=5000)
    contract_type: Optional[str] = Field(None, max_length=50)
    work_modality: Optional[str] = Field(None, max_length=50)
    sector: Optional[str] = Field(None, max_length=255)
    portal_id: Optional[int] = None
    company_id: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_company_fields(cls, data):
        company = getattr(data, "company", None)
        result = {
            "id": data.id,
            "title": data.title,
            "company_name": company.name if company else None,
            "company_id": data.company_id,
            "location": data.location,
            "offer_url": data.offer_url,
            "job_description": data.job_description,
            "contract_type": data.contract_type,
            "work_modality": data.work_modality,
            "sector": data.sector,
            "portal_id": data.portal_id,
            "salary_min": data.salary_min,
            "salary_max": data.salary_max,
            "published_at": data.published_at,
            "status": data.status,
            "is_favourite": data.is_favourite,
        }
        return result

# Schema para vacantes filtradas
class VacancyFiltered(VacancySummary):
    location: Optional[str] = None
    sector: Optional[str] = None

# Schema para marcar como favorita
class FavouriteRequest(BaseModel):
    favourite: bool

# Schema para acciones masivas
class BulkActionRequest(BaseModel):
    vacancy_ids: List[int] = Field(..., min_length=1)  # Al menos una vacante
    action: Literal["discard","delete"]  # Acción a aplicar

# Schema para respuestas de mensaje
class MessageResponse(BaseModel):
    message: str

#Schema para cambiar estado de ofertas
class StatusRequest(BaseModel):
    status: str

# Schema para las asignaciones multiples de vacantes
class VacancyAssignmentRequest(BaseModel):
    hr_id: int
    vacancy_ids: List[int]

class CandidateMatchOut(BaseModel):
    id: int
    name: str
    specialty: str
    location: str
    status: str
    experience: Optional[str]
    email: Optional[str]
    is_favourite: bool
    verifies: bool
    match_score: int # 0-100
    application_status: Optional[str] # None si no hay aplicacion todavia

    model_config = ConfigDict(from_attributes=True)

class CandidateTrackingOut(BaseModel):
    id: int
    name: str          
    phase: str         
    result: Optional[str] = None  
    notes: Optional[List[str]] = []     
    date: datetime     

    model_config = ConfigDict(from_attributes=True)

class VacancyNoteOut(BaseModel):
    id: int
    name: str
    phase: str
    result: Optional[str] = None
    notes: List[str]
    date: datetime

    model_config = ConfigDict(from_attributes=True)

class VacancyNoteCreate(BaseModel):
    texto: str

class CandidateTrackingCreate(BaseModel):
    name: str
    phase: str
    result: Optional[str] = None
    notes: Optional[List[str]] = []