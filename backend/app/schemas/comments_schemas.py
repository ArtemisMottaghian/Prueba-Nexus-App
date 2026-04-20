from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

#  CREAR
class CommentCreate(BaseModel):
    comment: str = Field(..., description="Contenido de la nota")
    user_id: int = Field(..., description="ID del usuario que crea la nota") 

#  MODIFICAR
class CommentUpdate(BaseModel):
    comment: str = Field(..., description="Nuevo contenido de la nota")

# Lo que devolvemos al Frontend
class CommentResponse(BaseModel):
    id: int
    comment: str
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True