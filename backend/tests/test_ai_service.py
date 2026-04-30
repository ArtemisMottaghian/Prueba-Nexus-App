import pytest
from app.models.job_model import JobOffer
from app.models.candidates_model import Candidate
from app.services.ai_service import score_candidates_by_skills


def test_score_candidates_by_skills_ordering():
    """
    Prueba que la función de scoring calcula bien los porcentajes
    y devuelve a los candidatos ordenados de mejor a peor.
    """

    mock_vacancy = JobOffer(
        title="Desarrollador Python",
        job_description="Buscamos experto en Python, FastAPI y SQL para backend.",
    )

    c1 = Candidate(id=1, skills="java, spring, oracle")  # 0 coincidencias
    c2 = Candidate(
        id=2, skills="python, react, fastapi"
    )  # 2 coincidencias (python, fastapi) -> 2/3 = 66%
    c3 = Candidate(
        id=3, skills="sql, python, fastapi, docker"
    )  # 3 coincidencias (sql, python, fastapi) -> 3/4 = 75%

    candidates = [c1, c2, c3]

    result = score_candidates_by_skills(candidates, mock_vacancy, limit=2)

    assert len(result) == 2, "Debería devolver exactamente 2 candidatos por el límite"

    assert result[0].id == 3, "El candidato 3 debería ser el primero en la lista"

    assert result[1].id == 2, "El candidato 2 debería ser el segundo en la lista"

