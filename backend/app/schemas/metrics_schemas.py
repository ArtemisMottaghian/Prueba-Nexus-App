
from pydantic import BaseModel,Field

class LeadMetrics(BaseModel):

    new: int = Field(..., ge=0)
    contacted: int = Field(..., ge=0)
    inProgress: int = Field(..., ge=0)
    newChange: float = Field(..., ge=-100, le=100)  # Porcentaje entre -100% y 100%
    contactedChange: float = Field(..., ge=-100, le=100)
    inProgressChange: float = Field(..., ge=-100, le=100)