from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.db.models import OfferStatus

# Schema base para la tarjeta (Dashboard y Lista)
class VacancySummary(BaseModel):
    id: int
    title: str
    company_name: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    published_at: Optional[datetime] = None
    status: OfferStatus

    model_config = ConfigDict(from_attributes=True)

# Schema extendido para el detalle
# Hereda del resumen y le añade el resto de campos
class VacancyDetail(VacancySummary):
    location: Optional[str] = None
    offer_url: Optional[str] = None
    job_description: Optional[str] = None
    company_description: Optional[str] = None
    contract_type: Optional[str] = None
    work_modality: Optional[str] = None
    sector: Optional[str] = None