import os
import base64
from email.message import EmailMessage
from backend.app.db.connection import AsyncSessionLocal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.models.email_template_model import EmailTemplate, EmailTemplateSlug
from app.models.user_model import User


async def send_company_vacancy_email(
    db: AsyncSession, user: User, company_email: str, company_name: str, job_title: str
):
    """
    Busca la plantilla de confirmación de vacante, personaliza el contenido y envía el email.

    Args:
        db (AsyncSession): Sesión de la base de datos para buscar la plantilla.
        company_email (str): Email de destino de la empresa.
        company_name (str): Nombre de la empresa para personalizar el saludo.
        job_title (str): Título de la vacante para informar qué oferta se ha publicado.

    Returns:
        bool: True si el proceso se completó correctamente (en modo real o mock).
    """

    query = select(EmailTemplate).where(
        EmailTemplate.slug == EmailTemplateSlug.PROSPECT_VACANCY.value
    )
    result = await db.execute(query)
    template = result.scalar_one_or_none()

    if not template:
        print(
            f"[ERROR] No se encontró la plantilla '{EmailTemplateSlug.PROSPECT_VACANCY}' en la BBDD"
        )
        return False

    final_subject = template.subject.format(job_title=job_title)
    final_body = template.body.format(company_name=company_name, job_title=job_title)

    msg = EmailMessage()
    msg["Subject"] = final_subject
    msg["From"] = user.email
    msg["To"] = company_email
    msg.set_content("Por favor, visualiza este mensaje en formato HTML.")
    msg.add_alternative(final_body, subtype="html")

    mode = os.getenv("EMAIL_MODE", "mock").lower()

    if mode == "real":

        if not user.google_refresh_token:
            print(
                f"[ERROR] El usuario {user.email} no tiene cuenta de Gmail vinculada."
            )
            return False

        try:
            print(
                f"[EMAIL] Conectando al servidor SMTP para enviar a {company_email}..."
            )

            creds = Credentials(
                token=None,
                refresh_token=user.google_refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.getenv("GOOGLE_CLIENT_ID"),
                client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
            )

            gmail_service = build("gmail", "v1", credentials=creds)

            raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            body = {"raw": raw_message}

            gmail_service.users().messages().send(userId="me", body=body).execute()

            return True

        except Exception as e:
            print(f"[ERROR] Fallo crítico al enviar el email: {e}")
            return False

    else:
        print(f"[EMAIL TO COMPANY] Enviando a: {company_email}")
        print(f"[ASUNTO]: {final_subject}")
        print(f"[CONTENIDO]: {final_body[:100]}...")

        return True


async def send_company_vacancy_email_standalone(
    user: User, company_email: str, company_name: str, job_title: str
):
    """
    Función envoltorio para tareas en segundo plano (Background Tasks / asyncio).
    Genera su propia sesión de base de datos para no colisionar con el orquestador.
    """

    async with AsyncSessionLocal() as db:
        await send_company_vacancy_email(db, company_email, company_name, job_title)
