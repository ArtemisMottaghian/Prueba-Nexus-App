from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class EmailTemplateSlug(str, Enum):
    PROSPECT_VACANCY = "prospect_vacancy"
    VACANCY_CONFIRMATION = "vacancy_confirmation"

class EmailTemplate(Base):
    """
       Representa una plantilla de correo electrónico en la base de datos.
       """
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
