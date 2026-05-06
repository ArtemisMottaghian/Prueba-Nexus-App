from enum import Enum

from sqlalchemy import Column, Integer, String, Text
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
    slug = Column(String, unique=True, index=True, nullable=False) # Para buscar los mails que queramos
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
