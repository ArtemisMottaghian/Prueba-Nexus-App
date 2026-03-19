from pydantic import BaseModel

class NewUser(BaseModel):
    email: str
    password_hash: str
    role: str