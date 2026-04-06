from pydantic import BaseModel

class LeadMetrics(BaseModel):
    new: int
    newChange: float
    contacted: int
    contactedChange: float
    inProgress: int
    inProgressChange: float