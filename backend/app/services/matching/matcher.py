"""
Pipeline de matching en 2 fases:

  Phase 1 — fast_filter (sin IA)
    · Entrada: todos los candidatos activos de la DB (~1000+)
    · Lógica: skill overlap + ubicación
    · Salida: ~200 candidatos relevantes

  Phase 2 — ai_ranker (Claude Haiku)
    · Entrada: los ~200 del filtro rápido
    · Lógica: evaluación semántica de skills + experiencia + descripción oferta
    · Salida: top N candidatos con score 0-100 + reasoning

Uso desde un endpoint FastAPI:

    from app.services.matching.matcher import match_offer
    from app.db.session import AsyncSessionLocal

    @router.get("/offers/{offer_id}/matches")
    async def get_matches(offer_id: int, db = Depends(get_db)):
        offer = await get_offer_dict(db, offer_id)
        candidates = await get_active_candidates_dicts(db)
        result = await match_offer(candidates, offer, settings.ANTHROPIC_API_KEY)
        return result
"""

from dataclasses import dataclass, field

from .fast_filter import fast_filter, fast_filter_dicts
from .ai_ranker import rank_candidates, RankedCandidate


@dataclass
class MatchResult:
    offer_id: int | None
    total_candidates_input: int
    total_after_filter: int
    ranked: list[RankedCandidate] = field(default_factory=list)

    def to_dict(self) -> list[dict]:
        return [
            {
                "candidate_id": r.candidate_id,
                "score": r.score,
                "reasoning": r.reasoning,
                "matched_skills": r.matched_skills,
                "gaps": r.gaps,
                "candidate": {
                    "id": r.candidate_data.get("id"),
                    "first_name": r.candidate_data.get("first_name"),
                    "last_name": r.candidate_data.get("last_name"),
                    "location": r.candidate_data.get("location"),
                    "skills": r.candidate_data.get("skills"),
                    "source": r.candidate_data.get("source"),
                    "candidate_url": r.candidate_data.get("candidate_url"),
                },
            }
            for r in self.ranked
        ]


async def match_offer(
    candidates: list[dict],
    offer: dict,
    api_key: str,
    fast_filter_limit: int = 10,
    min_skill_overlap: int = 1,
    top_n: int = 5,
    use_ai: bool = True,
) -> MatchResult:
    """
    Pipeline completo de matching para una oferta.

    Args:
        candidates:         Lista de dicts de candidatos activos.
                            Cada dict debe incluir 'id', 'skills', 'location', etc.
        offer:              Dict del JobOffer con 'title', 'job_description', 'location', etc.
        api_key:            ANTHROPIC_API_KEY para la fase IA.
        fast_filter_limit:  Máximo de candidatos a pasar a la fase IA.
        min_skill_overlap:  Mínimo de skills en común para pasar el filtro rápido.
        top_n:              Cuántos devolver al final.
        use_ai:             Si False, devuelve solo resultados del fast_filter
                            (útil para preview rápido o cuando no hay API key).

    Returns:
        MatchResult con los candidatos rankeados.
    """
    print(f"[Matcher] Iniciando para oferta '{offer.get('title', 'N/A')}'")
    print(f"[Matcher] {len(candidates)} candidatos de entrada")

    # ── Fase 1: filtro rápido ──────────────────────────────────────────────
    filtered_full = fast_filter(
        candidates,
        offer,
        min_skill_overlap=min_skill_overlap,
        max_results=fast_filter_limit,
    )
    filtered = [fc.candidate for fc in filtered_full]
    print(f"[Matcher] {len(filtered)} candidatos tras filtro rápido")

    if not filtered:
        return MatchResult(
            offer_id=offer.get("id"),
            total_candidates_input=len(candidates),
            total_after_filter=0,
        )

    # ── Fase 2: ranking IA ─────────────────────────────────────────────────
    if not use_ai or not api_key:
        # Sin IA: usar score del fast_filter (skill_ratio + location_bonus) × 100
        ranked = [
            RankedCandidate(
                candidate_id=fc.candidate.get("id", 0),
                score=round(fc.score * 100),
                reasoning=f"Skill overlap: {fc.skill_overlap} skills coincidentes. Ubicación {'compatible' if fc.location_compatible else 'no verificada'}.",
                candidate_data=fc.candidate,
            )
            for fc in sorted(filtered_full, key=lambda x: x.score, reverse=True)[:top_n]
        ]
        return MatchResult(
            offer_id=offer.get("id"),
            total_candidates_input=len(candidates),
            total_after_filter=len(filtered),
            ranked=ranked,
        )

    ranked = await rank_candidates(
        candidates=filtered,
        offer=offer,
        api_key=api_key,
        top_n=top_n,
    )

    print(f"[Matcher] Top score: {ranked[0].score if ranked else 'N/A'}")

    return MatchResult(
        offer_id=offer.get("id"),
        total_candidates_input=len(candidates),
        total_after_filter=len(filtered),
        ranked=ranked,
    )
