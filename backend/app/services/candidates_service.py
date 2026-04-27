from sqlalchemy import select,func,case,distinct
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.models.candidates_model import Candidate 
from app.schemas.candidates_schemas import CandidateStatus, CandidateCreate,CandidateUpdate,ScraperStatusItem, CandidateScraperStatusOut
from datetime import datetime, timezone, timedelta
import re

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

async def search_candidates_by_name(db: AsyncSession, name: str) -> List[Candidate]:
    """Busca candidatos por nombre o apellido."""
    from sqlalchemy import or_
    query = select(Candidate).where(
        or_(
            Candidate.first_name.ilike(f"%{name}%"),
            Candidate.last_name.ilike(f"%{name}%")
        )
    ).order_by(Candidate.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

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

# ------------------------------------
# Mapa de normalización de ubicaciones
# ------------------------------------
_LOCATION_FIXES = {
    "a coruña": "A Coruña",
    "a coruna": "A Coruña",
    "la coruña": "A Coruña",
    "almeria": "Almería",
    "cadiz": "Cádiz",
    "malaga": "Málaga",
    "malága": "Málaga",
    "jaen": "Jaén",
    "cordoba": "Córdoba",
    "leon": "León",
    "gijon": "Gijón",
    "españa": None,
    "spain": None,
    "remote": None,
    "remoto": None,
    "ibiza": "Ibiza",
    "palencia": "Palencia",
    "segovia": "Segovia",
    "oviedo": "Oviedo",
    "sevilla": "Sevilla",
    "cartagena": "Cartagena",
    "valladolid": "Valladolid",
    "canarias": "Canarias",
    "catalonia": None,
    "cataluña": None,
    "galicia": None,
    "europe": None,
    "españa": None,
}

_INVALID_PATTERNS = re.compile(
    r'(linkedin\.com|http|\.com|@'
    r'|\d{5}'                           # códigos postales
    r'|c\/|blvd|plaza|universidad|university'
    r'|avenida|calle|carrer|campus|edificio|coronel|ctra\.|paseo|carretera'
    r'|\d+\s*(bajo|alto|s\/n)'          # números de portal
    r'|^[\d\s\.\,]+$'                   # solo números/puntos/comas
    r'|remot'                           # remote/remoto
    r'|\/.*\/'                          # formato "A / B / C"
    r'|between\s'                       # "Between Huelva & Granada"
    r'|lugo\s*@'                        # "Lugo @ A Coruña"
    r'|\w+\s*~\s*\w+'                   # "Logroño~Burgos~Pamplona"
    r'|lisbon|helsinki|tokyo'           # ciudades fuera de España
    r'|salt\b|malmö'
    r'|->|⊠|\.\s*spain|\.\s*españa)',   # flechas, símbolos raros
    re.IGNORECASE
)

def _normalize_location(raw: str) -> str | None:
    if not raw:
        return None
    # Descartar entradas con patrones inválidos
    if _INVALID_PATTERNS.search(raw):
        return None
    # Primer fragmento antes de coma, slash, guion largo, pipe
    city = re.split(r'[,/|–\-]', raw)[0].strip()
    # Eliminar sufijos tipo "(Spain)", "(GMT+1)"
    city = city.split("(")[0].strip()
    # Limpiar guion con contexto " - algo" al final
    city = re.sub(r'\s*-\s*(spain|españa|es|galicia|cataluña|asturias)$', '', city, flags=re.IGNORECASE).strip()
    # Descartar si queda vacío, muy corto, o sigla tipo "ES"
    if not city or len(city) < 3 or (city.isupper() and len(city) <= 3):
        return None
    # Aplicar correcciones del mapa (None = descartar)
    normalized = _LOCATION_FIXES.get(city.lower(), city)
    return normalized


async def get_location_options(db: AsyncSession) -> List[str]:
    """Devuelve lista de ciudades únicas normalizadas para el filtro del frontend."""
    from sqlalchemy import distinct
    query = select(distinct(Candidate.location)).where(Candidate.location.isnot(None))
    result = await db.execute(query)
    raw_locations = result.scalars().all()

    normalized: set[str] = set()
    for loc in raw_locations:
        city = _normalize_location(loc)
        if city:
            normalized.add(city)

    return sorted(normalized)

