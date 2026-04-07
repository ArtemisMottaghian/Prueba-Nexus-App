from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta,timezone
from app.db.connection import get_db
from app.services import metrics_service
from app.schemas.metrics_schemas import LeadMetrics

router = APIRouter()

# -----------------
# Obtener metricas
# GET /api/metrics
# -----------------

@router.get("", response_model=LeadMetrics)
async def read_metrics(
    start: datetime = Query(None, alias="from"),
    end: datetime = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db)
):
    # ultimos 30 dias por defecto
    if not end:
        end = datetime.now(timezone.utc)
    if not start:
        start = end - timedelta(days=30)

    return await metrics_service.get_lead_stats(db, start, end)