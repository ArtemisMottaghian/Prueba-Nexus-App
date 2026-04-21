from sqlalchemy import select,func,case
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.models.candidates_model import Candidate 
from app.schemas.candidates_schemas import CandidateStatus, CandidateCreate,CandidateUpdate,ScraperStatusItem, CandidateScraperStatusOut
from datetime import datetime, timezone, timedelta

async def get_all_candidates(
    db: AsyncSession,
    location: Optional[str] = None,
    skills: Optional[str] = None,
    status: Optional[CandidateStatus] = None,
    source: Optional[str] = None,
    verified: Optional[bool] = None,
) -> List[Candidate]:
    query = select(Candidate)

    if location:
        query = query.where(Candidate.location.ilike(f"%{location}%"))
    if skills:
        query = query.where(Candidate.skills.ilike(f"%{skills}%"))
    if status:
        query = query.where(Candidate.status == status)
    if source:
        query = query.where(Candidate.source.ilike(f"%{source}%"))
    if verified is not None:
        query = query.where(Candidate.verified == verified)

    query = query.order_by(Candidate.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

async def get_candidate_by_id(db: AsyncSession, candidate_id: int) -> Optional[Candidate]:
    query = select(Candidate).where(Candidate.id == candidate_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def create_candidate(db: AsyncSession, datos: CandidateCreate) -> Candidate:
    nuevo = Candidate(**datos.model_dump())
    db.add(nuevo)
    await db.commit()
    await db.refresh(nuevo)
    return nuevo


async def update_candidate(db: AsyncSession, candidate_id: int, datos: CandidateUpdate) -> Optional[Candidate]:
    candidate = await get_candidate_by_id(db, candidate_id)
    if not candidate:
        return None

    # Solo actualizamos los campos que vienen en el payload
    for field, value in datos.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)

    await db.commit()
    await db.refresh(candidate)
    return candidate

async def update_status(db: AsyncSession, candidate_id: int, new_status: CandidateStatus) -> Optional[Candidate]:
    candidate = await get_candidate_by_id(db, candidate_id)
    if not candidate:
        return None
        
    candidate.status = new_status
    await db.commit()
    await db.refresh(candidate)
    return candidate

async def delete_candidate(db: AsyncSession, candidate_id: int) -> bool:
    candidate = await get_candidate_by_id(db, candidate_id)
    if not candidate:
        return False

    await db.delete(candidate)
    await db.commit()
    return True


async def set_favorite(db: AsyncSession, candidate_id: int, favorite: bool) -> None:
    """Marca o desmarca un candidato como favorito."""
    try:
        query = select(Candidate).where(Candidate.id == candidate_id)
        result = await db.execute(query)
        candidate = result.scalar_one_or_none()

        if candidate:
            candidate.is_favorite = favorite
            await db.commit()
    except Exception as e:
        raise e



async def set_verified(db: AsyncSession, candidate_id: int, verified: bool) -> None:
    """Marca o desmarca un candidato como verificado."""
    candidate = await get_candidate_by_id(db, candidate_id)
    if candidate:
        candidate.verified = verified
        await db.commit()


async def get_scraper_status(db: AsyncSession) -> CandidateScraperStatusOut:
    """
    Devuelve el estado de cada scraper de candidatos basándose en
    el último registro insertado por fuente en la tabla candidates.
    """

    SCRAPERS = [
        {"name": "GitHub", "source": "GitHub API"},
        {"name": "LinkedIn (Bot)", "source": "LinkedIn"},
        {"name": "Google PDF", "source_prefix": "Google PDF"},
    ]

    now = datetime.now(timezone.utc)
    result_list = []

    for scraper in SCRAPERS:
        source = scraper.get("source")
        source_prefix = scraper.get("source_prefix")

        if source:
            query = select(
                func.max(Candidate.created_at).label("last_extraction"),
                func.count(Candidate.id).label("total")
            ).where(Candidate.source == source)
        else:
            query = select(
                func.max(Candidate.created_at).label("last_extraction"),
                func.count(Candidate.id).label("total")
            ).where(Candidate.source.like(f"{source_prefix}%"))

        result = await db.execute(query)
        row = result.one()

        last_extraction = row.last_extraction
        total = row.total

        # Lógica de estado
        if not last_extraction:
            status = "offline"
        else:
            if last_extraction.tzinfo is None:
                last_extraction = last_extraction.replace(tzinfo=timezone.utc)
            diff = now - last_extraction
            if diff <= timedelta(hours=24):
                status = "online"
            elif diff <= timedelta(days=3):
                status = "slow"
            else:
                status = "offline"

        result_list.append(ScraperStatusItem(
            name=scraper["name"],
            status=status,
            last_extraction=last_extraction,
            total_candidates=total
        ))

    return CandidateScraperStatusOut(scrapers=result_list)

