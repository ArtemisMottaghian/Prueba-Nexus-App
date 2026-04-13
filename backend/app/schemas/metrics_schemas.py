
from pydantic import BaseModel,Field
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LeadMetrics(BaseModel):

    new: int = Field(..., ge=0)
    contacted: int = Field(..., ge=0)
    inProgress: int = Field(..., ge=0)
    newChange: float = Field(..., ge=-100, le=100)  # Porcentaje entre -100% y 100%
    contactedChange: float = Field(..., ge=-100, le=100)
    inProgressChange: float = Field(..., ge=-100, le=100)

class ScraperStatus(BaseModel):
    status: str  # "online" | "warning" | "error" | "unknown"
    last_extraction: Optional[datetime] = None
    offers_today: int = 0
    error: Optional[str] = None

class ScrapersStatusResponse(BaseModel):
    adzuna: ScraperStatus
    infojobs: ScraperStatus
    linkedin: ScraperStatus