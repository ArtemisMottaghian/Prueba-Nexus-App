from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.email_service import send_company_vacancy_email

from app.schemas.email_templates_schemas import ManualProspectEmail

router = APIRouter()

@router.post("/send-prospect", status_code=202)
async def send_manual_prospect_template(db: AsyncSession = Depends(get_db)):
    success = await send_company_vacancy_email(
        db=db,
        company_email="example@gmail.com",
        company_name="TechCorp S.A.",
        job_title="Senior Python Backend Developer"
    )

    if success:
        return {"status": "ok", "message": "Mira la terminal de Uvicorn"}
    else:
        return {"status": "error", "message": "No se encontro la plantilla en la BBDD"}
