from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.models.candidates_model import Candidate 
from app.schemas.candidates_schemas import CandidateStatus, CandidateCreate,CandidateUpdate

async def get_all_candidates(db: AsyncSession) -> List[Candidate]:
    query = select(Candidate).order_by(Candidate.created_at.desc())
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