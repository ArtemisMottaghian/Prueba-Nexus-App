from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.email_service import send_company_vacancy_email
from app.schemas.email_templates_schemas import ManualProspectEmail

router = APIRouter()


@router.post("/send-prospect", status_code=202)
async def send_manual_prospect_template(
    data: ManualProspectEmail,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Envía manualmente un email de captación a una empresa.
    Los datos se reciben a través del body de la petición.
    """

    success = background_tasks.add_task(
        send_company_vacancy_email,
        db=db,
        company_email=data.company_email,
        company_name=data.company_name,
        job_title=data.job_title,
    )

    if success:
        return {"status": "accepted"}
    else:
        return {"status": "error"}
