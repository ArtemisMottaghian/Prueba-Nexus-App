"""
Stage 2 del pipeline de matching: ranking semántico con Claude.

Estrategia de coste:
  - Batches de 15 candidatos por llamada (reduce N llamadas a N/15)
  - System prompt cacheado con cache_control ephemeral (reutilizado entre batches)
  - Offer context cacheado en el primer mensaje de usuario (mismo offer → 1 cache hit)
  - Modelo haiku para ranking masivo, opus/sonnet para casos premium
  - Se salta la IA si hay < MIN_FOR_AI candidatos filtrados (no merece la pena)
"""

import asyncio
import json
import re
from dataclasses import dataclass, field

import anthropic

MIN_FOR_AI = 3       # Menos de esto → devolver por score del fast_filter
BATCH_SIZE = 5       # Candidatos por llamada a Claude
AI_MODEL = "claude-haiku-4-5-20251001"   # Rápido y barato para ranking masivo

_SYSTEM_PROMPT = """\
Eres un experto en selección de personal técnico para el mercado español.

Tu tarea: evaluar el ajuste entre candidatos y una oferta de trabajo.

Para cada candidato devuelves un objeto JSON con estos campos exactos:
  "id"              → int, el id del candidato
  "score"           → int 0-100, ajuste global
  "reasoning"       → string, 1-2 frases justificando el score en español
  "matched_skills"  → list[str], skills del candidato que encajan con la oferta
  "gaps"            → list[str], skills requeridas que le faltan

ESCALA DE SCORES:
  90-100 → ajuste casi perfecto, pocas o ninguna carencia relevante
  70-89  → buen ajuste, carencias menores o compensables con experiencia
  50-69  → ajuste moderado, carencias importantes pero no bloqueantes
  30-49  → ajuste débil, faltan skills clave
  0-29   → perfil muy alejado de la oferta

REGLAS DE EVALUACIÓN:
  - Evalúa semánticamente: "programador Python" = "Python developer" = "python"
  - Un perfil senior con 8 años de React supera "3 años requeridos" aunque no lo ponga explícitamente
  - Experiencia amplia en tecnologías relacionadas compensa gaps menores
  - Ubicación compatible con trabajo remoto no penaliza
  - Si faltan datos del candidato, evalúa con lo que hay (no penalices la falta de info)
  - Sé consistente: mismo perfil = mismo score en distintos batches

Responde ÚNICAMENTE con un array JSON válido. Sin markdown, sin texto extra.\
"""


@dataclass
class RankedCandidate:
    candidate_id: int
    score: int           # 0-100
    reasoning: str
    matched_skills: list[str] = field(default_factory=list)
    gaps: list[str] = field(default_factory=list)
    # Datos originales del candidato para tenerlos accesibles
    candidate_data: dict = field(default_factory=dict)


def _build_offer_context(offer: dict) -> str:
    return json.dumps(
        {
            "titulo": offer.get("title", ""),
            "descripcion": (offer.get("job_description") or "")[:600],
            "ubicacion": offer.get("location", ""),
            "sector": offer.get("sector", ""),
            "salario_min": offer.get("salary_min"),
            "salario_max": offer.get("salary_max"),
            "tipo_contrato": offer.get("contract_type", ""),
            "modalidad": offer.get("work_modality", ""),
        },
        ensure_ascii=False,
        indent=2,
    )


def _build_candidates_payload(candidates: list[dict]) -> str:
    simplified = [
        {
            "id": c.get("id"),
            "skills": (c.get("skills") or "")[:200],
            "experiencia": (c.get("experience") or "")[:200],
            "ubicacion": c.get("location", ""),
            "fuente": c.get("source", ""),
        }
        for c in candidates
    ]
    return json.dumps(simplified, ensure_ascii=False, indent=2)


def _parse_response(text: str) -> list[dict]:
    # Eliminar fences de markdown en cualquier posición
    text = re.sub(r"```[a-z]*", "", text)
    text = re.sub(r"```", "", text).strip()

    # Intento directo
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Extraer el primer array JSON que aparezca en el texto
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        return json.loads(match.group(0))

    raise json.JSONDecodeError("No JSON array found in response", text, 0)


async def _rank_batch(
    candidates: list[dict],
    offer_context_str: str,
    client: anthropic.AsyncAnthropic,
) -> list[RankedCandidate]:
    candidates_str = _build_candidates_payload(candidates)

    response = await client.messages.create(
        model=AI_MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": _SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"OFERTA:\n{offer_context_str}\n\nCANDIDATOS:\n{candidates_str}\n\nEvalúa y devuelve el array JSON.",
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            }
        ],
    )

    raw = _parse_response(response.content[0].text)

    # Construir mapa id → candidate para adjuntar datos originales
    id_map = {c.get("id"): c for c in candidates}

    results = []
    for r in raw:
        cid = r.get("id")
        results.append(
            RankedCandidate(
                candidate_id=cid,
                score=int(r.get("score", 0)),
                reasoning=r.get("reasoning", ""),
                matched_skills=r.get("matched_skills", []),
                gaps=r.get("gaps", []),
                candidate_data=id_map.get(cid, {}),
            )
        )
    return results


async def rank_candidates(
    candidates: list[dict],
    offer: dict,
    api_key: str,
    batch_size: int = BATCH_SIZE,
    top_n: int = 5,
) -> list[RankedCandidate]:
    """
    Rankea candidatos filtrados usando Claude.

    Args:
        candidates:  Lista de dicts (salida del fast_filter).
                     Cada dict debe tener campo 'id'.
        offer:       Dict con campos del JobOffer.
        api_key:     ANTHROPIC_API_KEY.
        batch_size:  Candidatos por llamada a la API (15 es el óptimo coste/calidad).
        top_n:       Cuántos devolver al final.

    Returns:
        Lista de RankedCandidate ordenada por score desc.
    """
    if len(candidates) < MIN_FOR_AI:
        # No merece llamada a IA: devolver con score 50 genérico
        return [
            RankedCandidate(
                candidate_id=c.get("id", 0),
                score=50,
                reasoning="Ranking por fast-filter (pocos candidatos para IA)",
                candidate_data=c,
            )
            for c in candidates
        ]

    client = anthropic.AsyncAnthropic(api_key=api_key)
    offer_context_str = _build_offer_context(offer)

    all_ranked: list[RankedCandidate] = []
    batches = [candidates[i:i + batch_size] for i in range(0, len(candidates), batch_size)]

    for i, batch in enumerate(batches):
        try:
            ranked = await _rank_batch(batch, offer_context_str, client)
            all_ranked.extend(ranked)
        except json.JSONDecodeError as e:
            print(f"[AI Ranker] JSON parse error en batch {i}: {e}")
            # Añadir candidatos del batch con score neutro para no perderlos
            for c in batch:
                all_ranked.append(
                    RankedCandidate(
                        candidate_id=c.get("id", 0),
                        score=40,
                        reasoning="Error de parsing en respuesta IA",
                        candidate_data=c,
                    )
                )
        except anthropic.RateLimitError:
            print(f"[AI Ranker] Rate limit en batch {i}. Esperando 30s...")
            await asyncio.sleep(30)
            try:
                ranked = await _rank_batch(batch, offer_context_str, client)
                all_ranked.extend(ranked)
            except Exception as e2:
                print(f"[AI Ranker] Reintento fallido: {e2}")
        except Exception as e:
            print(f"[AI Ranker] Error en batch {i}: {e}")

        # Pausa entre batches para no saturar rate limits
        if i < len(batches) - 1:
            await asyncio.sleep(0.5)

    all_ranked.sort(key=lambda r: r.score, reverse=True)
    return all_ranked[:top_n]
