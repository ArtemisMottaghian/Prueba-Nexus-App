from pydantic import BaseModel
from datetime import datetime

class ScraperKeywordBase(BaseModel):
    keyword: str
    type: str
    is_active: bool = True
    
class ScraperKeywordCreate(ScraperKeywordBase):
    pass

class ScraperKeywordResponse(ScraperKeywordBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True