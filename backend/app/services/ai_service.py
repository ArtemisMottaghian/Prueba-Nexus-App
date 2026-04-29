import os
import json
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai import types

from app.models.job_model import JobOffer
from app.models.candidates_model import Candidate
from app.schemas.ai_schemas import MatchResult

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("ERROR: No se ha encontrado GEMINI_API_KEY en las variables de entorno.")

client = genai.Client(api_key=api_key)

async def calculate_vacancy_match(db: AsyncSession, vacancy_id: int) -> dict:
    """
    Obtiene la vacante y los candidatos activos de la base de datos mediante
    SQLAlchemy y utiliza Gemini para calcular y devolver el top 3 de candidatos
    más compatibles según sus habilidades.
    """

    vacancy_query = select(JobOffer).where(JobOffer.id == vacancy_id)
    vacancy_result = await db.execute(vacancy_query)
    vacancy = vacancy_result.scalar_one_or_none()

    if not vacancy:
        return None

    candidates_query = select(Candidate)
    candidates_result = await db.execute(candidates_query)
    candidates = candidates_result.scalars().all()

    if not candidates:
        return {"top_candidates": {}}

    vacancy_text = (
        f"Title: {vacancy.title}\nFull description: {vacancy.job_description}"
    )

    candidates_text = ""
    for c in candidates:
        skills = c.skills or "Not specified"
        candidates_text += (
            f"- ID: {c.id}, Name: {c.first_name} {c.last_name}, Skills: {skills}\n"
        )

    prompt = f"""
    Eres un experto técnico de recursos humanos.
    Analiza esta vacante real de nuestra base de datos:
    {vacancy_text}
    
    Y compárala con nuestra lista de candidatos actual:
    {candidates_text}
    
    Devuelve un top 3 de los candidatos más compatibles.
    IMPORTANTE: El campo 'reason' debe estar redactado en español detallando exactamente por qué el candidato hace buen "match" con la oferta.
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
