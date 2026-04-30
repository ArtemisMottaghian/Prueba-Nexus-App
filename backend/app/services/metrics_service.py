from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from fastapi import HTTPException

from app.models.job_model import JobOffer
from backend.app.schemas.job_offer import OfferStatus
from app.models.error_log_model import ErrorLog
from datetime import timezone
from app.models.job_model import JobPortal

async def get_lead_stats(db: AsyncSession, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    try:
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
                raw = 100.0 if curr > 0 else 0.0
            else:
                raw = ((curr - prev) / prev) * 100
            clamped = max(-100.0, min(100.0, raw))
            return round(clamped, 2)

        # periodo actual
        c_new = await count_by_status(OfferStatus.detected, start_date, end_date)
        c_contacted = await count_by_status(OfferStatus.contacted, start_date, end_date)
        c_in_progress = await count_by_status(OfferStatus.negotiating, start_date, end_date)

        # periodo anterior
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

    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener métricas")

PORTAL_IDS = {
    "adzuna": 1,
    "infojobs": 2,
    "linkedin": 3,
}

async def get_scrapers_status(db: AsyncSession) -> dict:


    today = datetime.now(timezone.utc).date()
    result = {}

    for scraper, portal_id in PORTAL_IDS.items():

        # Última ejecución del scraper (nuevo campo)
        portal_query = select(JobPortal.last_run_at, JobPortal.last_run_status).where(
            JobPortal.id == portal_id
        )
        portal_res = await db.execute(portal_query)
        portal_row = portal_res.first()
        last_run_at = portal_row.last_run_at if portal_row else None
        last_run_status = portal_row.last_run_status if portal_row else None

        # Última oferta insertada por este portal
        last_offer_query = select(JobOffer.scraped_at).where(
            JobOffer.portal_id == portal_id
        ).order_by(JobOffer.scraped_at.desc()).limit(1)
        last_offer_res = await db.execute(last_offer_query)
        last_insertion = last_offer_res.scalar_one_or_none()

        # Ofertas de hoy
        offers_today_query = select(func.count(JobOffer.id)).where(
            JobOffer.portal_id == portal_id,
            func.date(JobOffer.scraped_at) == today
        )
        offers_today_res = await db.execute(offers_today_query)
        offers_today = offers_today_res.scalar() or 0

        # Último error de este scraper
        error_query = select(ErrorLog.message, ErrorLog.occurred_at).where(
            ErrorLog.error_code.ilike(f"%{scraper.upper()}%"),
            ErrorLog.is_resolved == False
        ).order_by(ErrorLog.occurred_at.desc()).limit(1)
        error_res = await db.execute(error_query)
        last_error = error_res.first()

        # Determinar status
        if last_run_status == "error" or last_run_status == "timeout":
            status = "error"
        elif last_error and last_run_at and last_error.occurred_at > last_run_at:
            status = "warning"
        elif last_run_at:
            status = "online"
        elif last_insertion:
            status = "online"
        else:
            status = "unknown"

        result[scraper] = {
            "status": status,
            "last_run_at": last_run_at,           # cuándo corrió el scraper
            "last_run_status": last_run_status,   # ok / error / timeout
            "last_insertion": last_insertion,      # cuándo se insertó la última oferta
            "offers_today": offers_today,
            "error": last_error.message if last_error else None
        }

    return result