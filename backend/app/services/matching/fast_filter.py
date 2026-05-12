"""
Stage 1 del pipeline de matching: filtro rápido sin IA.

Objetivo: reducir 1000+ candidatos a ~200 relevantes
antes de pasar al ranking con IA (caro y lento).

Criterios:
  - Overlap de skills (principal)
  - Compatibilidad de ubicación (bonus)
  - Umbral mínimo configurable
"""

from dataclasses import dataclass
from .skill_normalizer import parse_skills, parse_skills_from_description

# Mapeo de ciudades/regiones para considerar "compatible"
_LOCATION_GROUPS: list[set[str]] = [
    {"madrid", "alcobendas", "pozuelo", "getafe", "alcalá", "leganés", "móstoles"},
    {"barcelona", "badalona", "hospitalet", "sabadell", "terrassa", "mataró"},
    {"valencia", "alicante", "castellón"},
    {"sevilla", "málaga", "córdoba", "granada", "cádiz"},
    {"bilbao", "vitoria", "san sebastián", "pamplona"},
    {"zaragoza"},
    {"murcia"},
]

_REMOTE_SIGNALS = {"remoto", "remote", "teletrabajo", "trabajo remoto", "100% remoto", "españa"}


@dataclass
class FilteredCandidate:
    candidate: dict
    skill_overlap: int
    location_compatible: bool
    score: float


def _location_compatible(candidate_loc: str | None, offer_loc: str | None) -> bool:
    if not candidate_loc or not offer_loc:
        return True  # unknown → no penalizar

    c = candidate_loc.lower()
    o = offer_loc.lower()

    if any(sig in o for sig in _REMOTE_SIGNALS):
        return True

    if c == o:
        return True

    for group in _LOCATION_GROUPS:
        if any(city in c for city in group) and any(city in o for city in group):
            return True

    # Candidato en España + oferta sin ciudad específica → compatible
    if "españa" in c or "spain" in c:
        return True

    return False


def fast_filter(
    candidates: list[dict],
    offer: dict,
    min_skill_overlap: int = 1,
    max_results: int = 200,
) -> list[FilteredCandidate]:
    """
    Filtra y ordena candidatos por relevancia básica frente a una oferta.

    Args:
        candidates:        Lista de dicts con campos del modelo Candidate.
        offer:             Dict con campos del modelo JobOffer.
        min_skill_overlap: Mínimo de skills en común para no ser descartado.
                           Con 1 es permisivo (poco descarte de válidos).
                           Con 2 es más estricto.
        max_results:       Límite superior de candidatos a devolver.

    Returns:
        Lista de FilteredCandidate ordenada por score descendente.
    """
    offer_skills = parse_skills_from_description(
        (offer.get("title") or "") + " " + (offer.get("job_description") or "")
    )

    # Sin skills detectables en la oferta → devolver todos sin filtrar
    if not offer_skills:
        return [
            FilteredCandidate(
                candidate=c,
                skill_overlap=0,
                location_compatible=True,
                score=0.5,
            )
            for c in candidates[:max_results]
        ]

    results: list[FilteredCandidate] = []

    for c in candidates:
        c_skills = parse_skills(c.get("skills"))
        overlap = len(c_skills & offer_skills)
        loc_ok = _location_compatible(c.get("location"), offer.get("location"))

        # Filtro de exclusión
        passes = overlap >= min_skill_overlap or (loc_ok and overlap > 0)
        if not passes:
            continue

        # Score: skills (peso dominante) + bonus ubicación
        skill_ratio = overlap / len(offer_skills) if offer_skills else 0
        loc_bonus = 0.1 if loc_ok else 0.0
        score = round(skill_ratio + loc_bonus, 4)

        results.append(
            FilteredCandidate(
                candidate=c,
                skill_overlap=overlap,
                location_compatible=loc_ok,
                score=score,
            )
        )

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:max_results]


def fast_filter_dicts(
    candidates: list[dict],
    offer: dict,
    min_skill_overlap: int = 1,
    max_results: int = 200,
) -> list[dict]:
    """Wrapper que devuelve dicts directamente (más cómodo para pasar al AI ranker)."""
    filtered = fast_filter(candidates, offer, min_skill_overlap, max_results)
    return [fc.candidate for fc in filtered]
