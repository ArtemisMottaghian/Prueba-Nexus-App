import asyncio
from typing import Any

from app.core.scraper_candidates_linkedin_config import (
    SECTORS,
    LOCATIONS,
    HEADLESS_MODE,
)
from app.services.scrapers.scraper_candidates_github.runner import extract_github
from app.services.scrapers.scraper_candidates_pdf_google.runner import extract_pdfs_google
from app.services.scrapers.scraper_candidates_linkedin.runner import extract_linked
from sqlalchemy.dialects.postgresql import insert

from app.models.candidates_model import Candidate
from app.schemas.candidates_schemas import CandidateCreate

from app.db.connection import AsyncSessionLocal
from app.services.scrapers.scraper_candidates_github.utils import upsert_scraped_candidate 

async def gather_raw_candidates() -> list[dict]:
    """
    Ejecuta todos los scrapers de forma secuencial, gestiona los errores
    y unifica todos los resultados en una sola lista plana.
    """
    raw_candidates = []

    # Lista de scrapers a ejecutar
    # NOTA: Usamos lambda para pre-cargar los argumentos de LinkedIn
    scrapers = [
        (
            "linkedin",
            lambda: extract_linked(
                #keywords=KEYWORDS,
                sectors=SECTORS,
                locations=LOCATIONS,
                headless=HEADLESS_MODE,
            ),
        ),
        #("github", extract_github),
        #("google_pdfs", extract_pdfs_google),
    ]

    for name, scraper_func in scrapers:
        print(f"\nIniciando scraper: {name.upper()}...")
        try:
            result = await scraper_func()

            if isinstance(result, list):
                raw_candidates.extend(result)
                print(f"{name.upper()} terminado. {len(result)} perfiles extraídos.")

        except Exception as e:
            print(f"Error crítico en {name.upper()}: {e}")

    return raw_candidates


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

    print(f"Total de {len(valid_candidates)} ofertas validadas.")

    return valid_candidates

async def save_candidates_to_db(valid_candidates: list[CandidateCreate] ) -> None:
    """
    Guarda los candidatos validados en la base de datos.
    Si el candidato ya existe (mismo email), simplemente lo ignora.

    Args:
        valid_candidates (list[CandidateCreate]): Lista de candidatos validados.

    Returns:
        None
    """
    cambios_count = 0
    
    if not valid_candidates:
        print("\nNo hay candidatos válidos para guardar en la base de datos.")
        return

    new_count = 0

    async with AsyncSessionLocal() as session:
        
        for candidate in valid_candidates:
            data = candidate.model_dump()

            if data.get("candidate_url"):
                data["candidate_url"] = str(data["candidate_url"])

            if data.get("cv_url"):
                data["cv_url"] = str(data["cv_url"])

            guardado = await upsert_scraped_candidate(session, data)
            
            if guardado:
                cambios_count +=1
                    
    print(f"\n Operación finalizada: {cambios_count} candidatos nuevos o actualizados en DB.")

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
