from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.models.job_model import JobOffer
from app.schemas.job_offer import OfferStatus

async def get_lead_stats(db: AsyncSession, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    # periodo anterior para comparar
    duration = end_date - start_date
    prev_start = start_date - duration
    prev_end = start_date

    # contar por estado y periodo
    async def count_by_status(status: OfferStatus, s: datetime, e: datetime) -> int:
        query = select(func.count(JobOffer.id)).where(
            JobOffer.status == status,
            JobOffer.published_at >= s,
            JobOffer.published_at <= e
        )
        result = await db.execute(query)
        return result.scalar() or 0

    # porcentaje de cambio 
    def calc_pct(curr: int, prev: int) -> float:
        if prev == 0:
            return 100.0 if curr > 0 else 0.0
        return round(((curr - prev) / prev) * 100, 2)

    # periodo actual
    c_new = await count_by_status(OfferStatus.detected, start_date, end_date)
    c_contacted = await count_by_status(OfferStatus.contacted, start_date, end_date)
    c_in_progress = await count_by_status(OfferStatus.negotiating, start_date, end_date)

    # Periodo anterior
    p_new = await count_by_status(OfferStatus.detected, prev_start, prev_end)
    p_contacted = await count_by_status(OfferStatus.contacted, prev_start, prev_end)
    p_in_progress = await count_by_status(OfferStatus.negotiating, prev_start, prev_end)

    # respuesta
    return {
        "new": c_new,
        "newChange": calc_pct(c_new, p_new),
        "contacted": c_contacted,
        "contactedChange": calc_pct(c_contacted, p_contacted),
        "inProgress": c_in_progress,
        "inProgressChange": calc_pct(c_in_progress, p_in_progress)
    }