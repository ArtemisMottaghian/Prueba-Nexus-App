import os
import smtplib
from email.message import EmailMessage
from backend.app.db.connection import AsyncSessionLocal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.email_template_model import EmailTemplate, EmailTemplateSlug


async def send_company_vacancy_email(
    db: AsyncSession, company_email: str, company_name: str, job_title: str
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
        print(f"[ERROR] No se encontró la plantilla '{EmailTemplateSlug.PROSPECT_VACANCY}' en la BBDD")
        return False

    final_subject = template.subject.format(job_title=job_title)
    final_body = template.body.format(company_name=company_name, job_title=job_title)

    msg = EmailMessage()
    msg["Subject"] = final_subject
    msg["From"] = os.getenv("SMTP_USER", "no-reply@nexus.com")
    msg["To"] = company_email
    msg.set_content("Por favor, visualiza este mensaje en formato HTML.")
    msg.add_alternative(final_body, subtype="html")

    mode = os.getenv("EMAIL_MODE", "mock").lower()

    if mode == "real":
        try:
            print(
                f"[EMAIL] Conectando al servidor SMTP para enviar a {company_email}..."
            )

            smtp_server = os.getenv("SMTP_SERVER")
            smtp_port = int(os.getenv("SMTP_PORT", 465))
            smtp_user = os.getenv("SMTP_USER")
            smtp_password = os.getenv("SMTP_PASSWORD")

            with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            print(f"[INFO] Email enviado de verdad con éxito a {company_email}")
            return True

        except Exception as e:
            print(f"[ERROR] Fallo crítico al enviar el email real: {e}")
            return False

    else:
        print(f"[EMAIL TO COMPANY] Enviando a: {company_email}")
        print(f"[ASUNTO]: {final_subject}")
        print(f"[CONTENIDO]: {final_body[:100]}...")

        return True

async def send_company_vacancy_email_standalone(
        company_email: str,
        company_name: str,
        job_title: str
):
    """
    Función envoltorio para tareas en segundo plano (Background Tasks / asyncio).
    Genera su propia sesión de base de datos para no colisionar con el orquestador.
    """

    async with AsyncSessionLocal() as db:
        await send_company_vacancy_email(db, company_email, company_name, job_title)
