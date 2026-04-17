import asyncio
from typing import Any
from app.services.scrapers.scraper_candidates_github.runner import extract_github
from app.services.scrapers.scraper_candidates_pdf_google.runner import extract_pdfs_google
from sqlalchemy.dialects.postgresql import insert

from app.models.candidates_model import Candidate
from app.schemas.candidates_schemas import CandidateCreate

from app.db.connection import AsyncSessionLocal


async def gather_raw_candidates() -> list[dict[str, Any]]:
    """
    Ejecuta todos los scrapers de forma concurrente/secuencial, gestiona los errores 
    individuales y unifica todos los resultados en una sola lista plana.

    Returns:
        list[dict[str, Any]]: Lista de diccionarios crudos con los candidatos extraídos.
    """

    raw_candidates = []

    scrapers = [
        
        ("github", extract_github),
        ("pdfs", extract_pdfs_google)
    ]

    for name, scraper_func in scrapers:
        try:
            result = await scraper_func()

            if isinstance(result, list):
                raw_candidates.extend(result)
    
        
        except Exception as e:
            print(f"Error crítico en {name.upper(): {e}}")

    print(f"Total de {len(raw_candidates)} ofertas conseguidas.")

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

    if not valid_candidates:
        print("\nNo hay candidatos válidos para guardar en la base de datos.")
        return

    new_count = 0

    async with AsyncSessionLocal() as session:
        try:
            for candidate in valid_candidates:
                data = candidate.model_dump()

                if data.get("candidate_url"):
                    data["candidate_url"] = str(data["candidate_url"])

                if data.get("cv_url"):
                    data["cv_url"] = str(data["cv_url"])

                stmt = insert(Candidate).values(**data)
                stmt = stmt.on_conflict_do_nothing(
                    index_elements=[
                        "email"
                    ]
                ).returning(Candidate.id)

                result = await session.execute(stmt)
                new_id = result.scalar_one_or_none()

                if new_id:
                    new_count += 1

            await session.commit()

        except Exception as e:
            await session.rollback()

    print(f"\n✅ Operación finalizada: {new_count} candidatos nuevos guardados en DB.")

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
