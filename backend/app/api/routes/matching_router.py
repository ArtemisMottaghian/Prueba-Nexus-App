from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.connection import get_db
from app.models.candidates_model import Candidate
from app.models.job_model import JobOffer
from app.core.config import settings
from app.services.matching.matcher import match_offer

router = APIRouter()


def _candidate_to_dict(c: Candidate) -> dict:
    return {
        "id": c.id,
        "first_name": c.first_name,
        "last_name": c.last_name,
        "email": c.email,
        "location": c.location,
        "source": c.source,
        "experience": c.experience,
        "skills": c.skills,
        "candidate_url": str(c.candidate_url) if c.candidate_url else None,
    }


def _offer_to_dict(o: JobOffer) -> dict:
    return {
        "id": o.id,
        "title": o.title,
        "job_description": o.job_description,
        "location": o.location,
        "sector": o.sector,
        "salary_min": o.salary_min,
        "salary_max": o.salary_max,
        "contract_type": o.contract_type,
        "work_modality": o.work_modality,
    }


@router.get("/anthropic/offers/{offer_id}/matches")
async def get_matches_anthropic(
    offer_id: int,
    top_n: int = Query(default=5, ge=1, le=100),
    min_skill_overlap: int = Query(default=1, ge=0),
    use_ai: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
):
    offer_row = await db.get(JobOffer, offer_id)
    if not offer_row:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")

    candidates_result = await db.execute(select(Candidate))
    candidates = [_candidate_to_dict(c) for c in candidates_result.scalars().all()]

    if not candidates:
        return {
            "offer_id": offer_id,
            "total_candidates_input": 0,
            "total_after_filter": 0,
            "ranked": [],
        }

    result = await match_offer(
        candidates=candidates,
        offer=_offer_to_dict(offer_row),
        api_key=settings.ANTHROPIC_API_KEY,
        top_n=top_n,
        min_skill_overlap=min_skill_overlap,
        use_ai=use_ai,
    )

    return {
        "offer_id": result.offer_id,
        "total_candidates_input": result.total_candidates_input,
        "total_after_filter": result.total_after_filter,
        "ranked": result.to_dict(),
    }
