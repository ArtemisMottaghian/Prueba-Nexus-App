from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

class ErrorLogResponse(BaseModel):
    id: int
    error_code: str
    message: str
    is_resolved: bool
    occurred_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ErrorLogResolve(BaseModel):
    is_resolved: bool

class ErrorLogList(BaseModel):
    total: int
    errors: List[ErrorLogResponse]