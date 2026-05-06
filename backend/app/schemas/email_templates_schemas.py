from pydantic import BaseModel, EmailStr


class EmailTemplateBase(BaseModel):
    slug: str
    name: str
    subject: str
    body: str


class EmailTemplateResponse(EmailTemplateBase):
    id: int

    class Config:
        from_attributes = True


class ManualProspectEmail(BaseModel):
    company_email: EmailStr
    company_name: str
    job_title: str
