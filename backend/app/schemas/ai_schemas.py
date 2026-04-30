from pydantic import BaseModel
from typing import List

class CompatibleCandidate(BaseModel):
    """
    Esquema que representa a un candidato evaluado por la IA.
    """

    candidate_id: int
    name: str
    affinity_percentage: int
    reason: str

class MatchResult(BaseModel):
    """
    Esquema principal de respuesta que contiene el top de candidatos.
    """

    top_candidates: List[CompatibleCandidate]
