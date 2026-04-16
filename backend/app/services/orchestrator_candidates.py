import asyncio
from typing import Any
from app.core.scraper_linkedin_candidatos_config import (
    KEYWORDS,
    SECTORS,
    LOCATIONS,
    HEADLESS_MODE,
)
from app.services.scrapers.scraper_empleados_linkedin.main import run_scraper
from app.services.scrapers.scraper_github.main_github import run_github_scraper
from app.services.scrapers.scraper_pdf_google.main_pdf_google import run_pdf_scraper
from app.schemas.candidate import CandidateCreate

from backend.app.db.connection import AsyncSessionLocal
from backend.app.services.scrapers.scraper_github.scraper_repository import upsert_scraped_candidate


async def gather_raw_candidates() -> list[dict[str, Any]]:
    """
    Ejecuta todos los scrapers de forma concurrente/secuencial, gestiona los errores 
    individuales y unifica todos los resultados en una sola lista plana.

    Returns:
        list[dict[str, Any]]: Lista de diccionarios crudos con los candidatos extraídos.
    """

    raw_candidates = []

    scrapers = [
        (
            "linkedin",
            lambda: extract_linkedin(
                keywords=KEYWORDS,
                sectors=SECTORS,
                locations=LOCATIONS,
                headless=HEADLESS_MODE,
            ),
        ),
        ("github", run_github_scraper),
        ("google_pdfs", run_pdf_scraper),
    ]

    for name, scraper_func in scrapers:
        try:
            result = await scraper_func()

            if isinstance(result, list):
                raw_candidates.extend(result)
        
        except Exception as e:
            print(f"Error crítico en {name.upper(): {e}}")

def validate_candidates(raw_candidates: list[dict[str, Any]]) -> list[CandidateCreate]:
    """
    Valida los candidatos crudos contra el esquema estricto de Pydantic.

    Args:
        raw_candidates (list[dict[str, Any]]): Lista de candidatos crudos extraídos.

    Returns:
        list[CandidateCreate]: Lista de candidatos validados como objetos Pydantic.
    """

    valid_candidates = []

    for raw in raw_candidates:
        try:
            validated_candidates = CandidateCreate(**raw)
            valid_candidates.append(validated_candidates)

        except Exception as e:
            continue
    
    return valid_candidates

async def save_candidates_to_db(valid_candidates: list[CandidateCreate] ) -> None:
    """
        Guarda o actualiza los candidatos validados en la base de datos.

        Args:
            valid_candidates (list[CandidateCreate]): Lista de candidatos validados.

        Returns:
            None
        """

    if not valid_candidates:
        return

    async with AsyncSessionLocal() as session:
        for candidate in valid_candidates:
            try:
                await upsert_scraped_candidate(session, candidate.model_dump())
            except Exception:
                await session.rollback()
                continue

async def run_candidate_scrapers():
    """
        Orquestador principal. Coordina la extracción, validación y persistencia.

        Returns:
            None
        """

    raw_candidates = await gather_raw_candidates()
    if not raw_candidates:
        return

    valid_candidates = validate_candidates(raw_candidates)
    if not valid_candidates:
        return

    await save_candidates_to_db(valid_candidates)

if __name__ == "__main__":
    asyncio.run(run_candidate_scrapers())
