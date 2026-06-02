import os
import json
import re
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai import types
from sqlalchemy.orm import selectinload

from app.models.job_model import JobOffer
from app.models.candidates_model import Candidate
from app.schemas.ai_schemas import MatchResult

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "ERROR: No se ha encontrado GEMINI_API_KEY en las variables de entorno."
    )

client = genai.Client(api_key=api_key)


async def fetch_pre_filtered_candidates(
    db: AsyncSession, vacancy: JobOffer
) -> list[Candidate]:
    """
    Obtiene los candidatos de la base de datos aplicando un filtro de ubicación preliminar.

    Si la modalidad de la vacante no es 'remoto', se filtra a los candidatos
    cuya ubicación contenga la ciudad base extraída de la ubicación de la oferta.
    Además, incluye las relaciones de comentarios de cada candidato.

    Args:
        db (AsyncSession): Sesión asíncrona de SQLAlchemy.
        vacancy (JobOffer): Instancia de la vacante a evaluar.

    Returns:
        list[Candidate]: Lista de candidatos que superan el filtro inicial.
    """
    base_query = select(Candidate).options(selectinload(Candidate.comments))

    is_remote = vacancy.work_modality and vacancy.work_modality.lower() == "remoto"

    if not is_remote and vacancy.location:
        # Extrae solo la ciudad base (ej. convierte "Madrid, España" en "Madrid")
        base_city = vacancy.location.split(",")[0].strip()
        base_query = base_query.where(Candidate.location.ilike(f"%{base_city}%"))

    result = await db.execute(base_query)
    return result.scalars().all()


def score_candidates_by_skills(
    candidates: list[Candidate], vacancy: JobOffer, limit: int = 20
) -> list[tuple[float, Candidate]]:
    """
    Evalúa y puntúa a los candidatos mediante un sistema de puntuación algorítmico.

    El algoritmo descarta automáticamente a los candidatos sin habilidades registradas
    o sin ninguna coincidencia exacta con la descripción y título de la vacante.
    La puntuación se calcula en base a:
    - Match de Skills (hasta 60 pts).
    - Experiencia y coincidencia de seniority (hasta 25 pts).
    - Estado de verificación (15 pts).
    - Estado de favorito (5 pts).

    Args:
        candidates (list[Candidate]): Lista de candidatos pre-filtrados a evaluar.
        vacancy (JobOffer): Instancia de la vacante base para la evaluación.
        limit (int, opcional): Número máximo de candidatos a devolver en el ranking. Por defecto es 20.

    Returns:
        list[tuple[float, Candidate]]: Lista de tuplas ordenadas de mayor a menor,
        donde cada tupla contiene la puntuación final (float) y la instancia del candidato.
    """
    if not candidates:
        return []

    vacancy_desc_lower = (
        vacancy.job_description.lower() if vacancy.job_description else ""
    )
    vacancy_title_lower = vacancy.title.lower() if vacancy.title else ""
    full_vacancy_text = f"{vacancy_title_lower} {vacancy_desc_lower}"

    scored_candidates = []

    for c in candidates:
        score = 0

        # --- 1. SKILLS ---
        skills_str = c.skills or ""
        candidate_skills = [
            s.strip().lower()
            for s in skills_str.replace("|", ",").split(",")
            if s.strip()
        ]

        if not candidate_skills:
            continue

        # Búsqueda exacta a prueba de símbolos como C++, C#, etc.
        matches = sum(
            1
            for skill in candidate_skills
            if re.search(rf"(?<!\w){re.escape(skill)}(?!\w)", full_vacancy_text)
        )

        if matches == 0:
            continue

        score += (matches / len(candidate_skills)) * 60

        # --- 2. EXPERIENCIA Y SENIORITY ---
        if c.experience:
            exp_lower = c.experience.lower()
            score += 10
            seniority_keywords = [
                "senior",
                "junior",
                "lead",
                "manager",
                "arquitecto",
                "director",
            ]
            for word in seniority_keywords:
                if word in exp_lower and word in full_vacancy_text:
                    score += 15
                    break

        # --- 3. VERIFICACIÓN Y FAVORITOS ---
        if c.verified:
            score += 15
        if c.is_favourite:
            score += 5

        scored_candidates.append((score, c))

    # Ordenamos de mayor a menor y cortamos en el límite
    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    return scored_candidates[:limit]


def build_gemini_prompt(vacancy: JobOffer, top_candidates: list[Candidate]) -> str:
    """
    Construye el prompt estructurado para enviar a la IA generativa.

    Genera una cadena de texto que incluye el contexto de la vacante,
    la información de los candidatos filtrados (habilidades y comentarios de RRHH),
    y las instrucciones para que la IA justifique su selección basándose en los datos proporcionados.

    Args:
        vacancy (JobOffer): Instancia de la vacante a evaluar.
        top_candidates (list[Candidate]): Lista de los candidatos mejor puntuados.

    Returns:
        str: Cadena de texto formateada para ser procesada por el modelo de IA.
    """
    vacancy_text = (
        f"Title: {vacancy.title}\nFull description: {vacancy.job_description}"
    )

    candidates_text = ""
    for c in top_candidates:
        skills = c.skills or "Not specified"
        hr_notes = "Sin notas."
        if getattr(c, "comments", None) and len(c.comments) > 0:
            hr_notes = " | ".join([nota.comment for nota in c.comments])
        candidates_text += f"- ID: {c.id}, Name: {c.first_name} {c.last_name}, Skills: {skills}, HR Notes: {hr_notes}\n"

    return f"""
    Eres un experto técnico de recursos humanos.
    Analiza esta vacante real de nuestra base de datos:
    {vacancy_text}
    
    Y compárala con nuestra lista de candidatos (pre-filtrados y ordenados matemáticamente):
    {candidates_text}
    
    Devuelve un top 8 de los candidatos más compatibles.
    IMPORTANTE: El campo 'reason' debe estar redactado en español detallando exactamente por qué el candidato hace buen "match" con la oferta.
    OBLIGATORIO: Si el candidato tiene 'HR Notes' (notas de los reclutadores), debes mencionarlas e integrarlas en tu justificación para dar contexto interno.
    """


def get_match_from_gemini(prompt: str) -> dict:
    """
    Ejecuta una solicitud al modelo generativo Gemini para procesar el prompt.

    Args:
        prompt (str): Texto estructurado con la información y las instrucciones.

    Returns:
        dict: Diccionario que representa la respuesta del modelo procesada según el esquema `MatchResult`.
    """
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=MatchResult,
            temperature=0.1,
        ),
    )
    return json.loads(response.text)


async def calculate_vacancy_match(db: AsyncSession, vacancy_id: int) -> dict:
    """
    Orquesta el flujo principal de emparejamiento entre una vacante y los candidatos.

    El proceso incluye la obtención de la vacante, un filtro duro en base de datos
    por ubicación, un filtro blando mediante puntuación algorítmica de habilidades
    y experiencia, y opcionalmente la delegación de la redacción cualitativa
    a un modelo de IA.

    Args:
        db (AsyncSession): Sesión asíncrona de SQLAlchemy.
        vacancy_id (int): Identificador único de la vacante a evaluar.

    Returns:
        dict: Diccionario con la clave 'top_candidates', que contiene una lista
        de diccionarios con la información y justificación del ajuste de cada candidato.
    """
    vacancy_query = select(JobOffer).where(JobOffer.id == vacancy_id)
    vacancy_result = await db.execute(vacancy_query)
    vacancy = vacancy_result.scalar_one_or_none()

    if not vacancy:
        return {"top_candidates": []}

    # 1. Filtro duro (Ubicación/Base de datos)
    pre_filtered_candidates = await fetch_pre_filtered_candidates(db, vacancy)

    print(
        f"\n[INFO] Evaluando Oferta {vacancy.id}: {vacancy.title} ({vacancy.location})"
    )
    print(f"[INFO] Candidatos en zona geográfica: {len(pre_filtered_candidates)}")

    if not pre_filtered_candidates:
        print("[WARN] No hay candidatos que coincidan con la ubicación.")
        return {"top_candidates": []}

    # 2. Filtro blando (Cálculo matemático)
    top_candidates_with_scores = score_candidates_by_skills(
        pre_filtered_candidates, vacancy, limit=20
    )

    print(
        f"[INFO] Candidatos que superaron la guillotina de skills: {len(top_candidates_with_scores)}"
    )

    if not top_candidates_with_scores:
        print("[WARN] Candidatos encontrados por zona, pero ninguno superó las skills.")
        return {"top_candidates": []}

    # ---------------------------------------------------------
    # ⚙️ INTERRUPTOR DE MODO: IA (GEMINI) vs MOCK (LOCAL)
    # ---------------------------------------------------------

    # 🟢 OPCIÓN A: LLAMADA REAL A GEMINI (Producción)
    # IMPORTANTE: Descomenta este bloque (borra las triple comillas) para usar la IA.
    """
    try:
        print("[INFO] Enviando datos a Gemini para redacción de motivos...")
        top_candidates = [item[1] for item in top_candidates_with_scores]
        prompt = build_gemini_prompt(vacancy, top_candidates)
        return get_match_from_gemini(prompt)
    except Exception as e:
        print(f"[ERROR] Fallo al contactar con Gemini: {e}")
        return {"top_candidates": []}
    """

    # 🟡 OPCIÓN B: MOCK DE RESPUESTA (Desarrollo / Ahorro de Tokens)
    # IMPORTANTE: Comenta este bloque completo si has activado la OPCIÓN A.
    fake_results = []
    for score, candidate in top_candidates_with_scores[:8]:
        fake_results.append(
            {
                "candidate_id": candidate.id,
                "name": f"{candidate.first_name} {candidate.last_name}",
                "affinity_percentage": round(score, 2),
                "reason": f"[MODO MOCK] Afinidad del {score:.2f}% calculada por algoritmo matemático (IA desactivada).",
            }
        )

    return {"top_candidates": fake_results}
