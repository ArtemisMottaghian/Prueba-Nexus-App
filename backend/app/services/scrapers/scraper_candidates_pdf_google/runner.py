import asyncio
import os
import json
import random
import re
import urllib.parse
from datetime import datetime, timedelta

import anthropic 
import aiohttp
import fitz  
from google import genai 
from dotenv import load_dotenv

from app.db.session import AsyncSessionLocal
from .utils import upsert_scraped_candidate
from app.core.scraper_candidates_pdf_config import SECTORES, CIUDADES, HEADLESS_MODE
from .browser import search_google_pdfs 


# INICIALIZACIÓN Y CONFIGURACIÓN

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_AI_KEY"))
# claude_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

LIMIT_FILE = "daily_limit.json"
MAX_DAILY_CV = 4

class AILimitReachedError(Exception):
    pass

def check_daily_limit() -> tuple[int, str]:
    """
    Consulta el archivo local de límites para saber cuántos CVs se han procesado en el día actual.

    Returns:
        int: Número de currículums procesados hoy.
    """

    today = datetime.now().strftime("%Y-%m-%d")
    if not os.path.exists(LIMIT_FILE):
        return 0, today

    try:
        with open(LIMIT_FILE, "r") as f:
            data = json.load(f)
            if data.get("date") == today:
                return data.get("count", 0), today
            else:
                return 0, today
    except Exception:
        return 0, today

def update_daily_limit(count: int) -> None:
    """
    Actualiza el contador de currículums procesados en el archivo de límites diario.

    Args:
        count (int): El nuevo número total de currículums procesados hoy.

    Returns:
        None
    """

    today = datetime.now().strftime("%Y-%m-%d")
    with open(LIMIT_FILE, "w") as f:
        json.dump({"date": today, "count": count}, f)


# 1. SACAR LINKEDIN

async def search_linkedin_url(first_name: str, last_name: str) -> str | None:
    """
    Busca la URL de perfil de LinkedIn de un candidato utilizando DuckDuckGo.

    Args:
        first_name (str): Nombre del candidato.
        last_name (str): Apellido del candidato.

    Returns:
        str | None: La URL del perfil de LinkedIn si se encuentra, de lo contrario None.
    """

    if not first_name or len(first_name) < 2: 
        return None

    print(f"    Buscando LinkedIn en DuckDuckGo para: {first_name} {last_name}...")

    # Preparamos la búsqueda para DuckDuckGo
    query = urllib.parse.quote_plus(f'"{first_name} {last_name}" España site:linkedin.com/in/')
    url = f"https://html.duckduckgo.com/html/?q={query}"

    # Cabeceras premium para que DuckDuckGo nos trate como a un usuario normal
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": "https://duckduckgo.com/"
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=8) as resp:
                if resp.status == 200:
                    html = urllib.parse.unquote(await resp.text())

                    # Buscamos la URL de LinkedIn dentro del código fuente
                    match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[a-zA-Z0-9%_.-]+)', html, re.IGNORECASE)

                    if match: 
                        link = match.group(1)
                        print(f"    ¡LinkedIn encontrado!: {link}")
                        return link
                    else:
                        print("    DuckDuckGo no devolvió ningún perfil.")
                else:
                    print(f"    DuckDuckGo bloqueó la búsqueda (Error {resp.status})")
    except Exception as e: 
        print(f"    Error de conexión con DuckDuckGo: {e}")

    return None


# 2. EL LECTOR IA (Con filtro estricto de país y Apagado)

async def extract_pdf_data(pdf_bytes: bytes) -> dict | None:
    """
    Extrae el texto de los bytes de un PDF y utiliza la API de Gemini para
    estructurar la información del candidato en formato JSON.

    Args:
        pdf_bytes (bytes): El contenido binario del archivo PDF.

    Returns:
        dict | None: Diccionario con los datos del candidato o None si no cumple requisitos.
    """

    try:
        text = ""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc: text += page.get_text()

        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) < 100: return None

        prompt = f"""
        Analiza este CV. 
        REGLA DE ORO: Solo nos interesan candidatos cuya residencia actual sea en España. Si el currículum indica que vive en otro país (ej: Ecuador, Colombia, Perú, etc.), devuelve exactamente esto y nada más: {{}}
        
        Si reside en España, devuelve SOLO un JSON estricto con: first_name, last_name, email, phone, location, sector, experience, skills. 
        Texto: {text[:6000]}
        """

        # --- INTENTO 1: GEMINI (GRATIS PERO CON PACIENCIA) ---
        for intento_gemini in range(3):
            try:
                response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                parsed_data = json.loads(clean_json)

                print("    Extraído con éxito usando: GEMINI")
                if isinstance(parsed_data, list) and len(parsed_data) > 0: return parsed_data[0]
                return parsed_data if parsed_data else None

            except Exception as gemini_error:
                error_str = str(gemini_error)
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    espera = 40 + (intento_gemini * 10) # Esperamos 40s, luego 50s...
                    print(f"    Límite de Gemini alcanzado. Esperando {espera} segundos para reintentar (Intento {intento_gemini + 1}/3)...")
                    await asyncio.sleep(espera)
                else:
                    print(f"    Gemini falló por otro error. {gemini_error}")
                    break # Salimos del bucle para ir a Claude

        # --- INTENTO 2: CLAUDE 3.5 HAIKU (SOLO SI GEMINI FALLA DEFINITIVAMENTE) ---
        # print("    Activando motor de respaldo (Claude)...")
        # try:
        #    message = await claude_client.messages.create(
        #        model="claude-3-5-haiku-20241022",
        #        max_tokens=500,
        #        messages=[{
        #            "role": "user",
        #            "content": prompt
        #        }]
        #    )

        #    clean_json = message.content[0].text.replace('```json', '').replace('```', '').strip()
        #    parsed_data = json.loads(clean_json)

        #    print("    Extraído con éxito usando: CLAUDE HAIKU")
        #    if isinstance(parsed_data, list) and len(parsed_data) > 0: return parsed_data[0]
        #    return parsed_data if parsed_data else None

        # except Exception as claude_error:
        #    print(f"    Fallo total en Claude (Probablemente sin saldo): {claude_error}")
        #    return None

        return None

    except Exception as e:
        print(f"[ERROR] Error general procesando PDF: {e}")
        return None


# 3. MOTOR PRINCIPAL

async def extract_pdfs_google() -> list[dict]:
    """
    Orquesta la búsqueda de archivos PDF en Google, la extracción de datos mediante IA
    y la recopilación de candidatos en una lista plana.

    Returns:
        list[dict]: Lista de diccionarios con los candidatos extraídos y validados por la IA.
    """

    all_extracted_candidates = []
    current_count, today_str = check_daily_limit()

    if current_count >= MAX_DAILY_CV:
        print(f"[INFO] Límite diario alcanzado ({MAX_DAILY_CV}/100) para hoy {today_str}. Vuelve mañana.")
        return

    hace_un_ano = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    print(f"\n--- RECOLECTOR PRO INICIADO: Llevamos {current_count}/{MAX_DAILY_CV} procesados hoy. ---")

    async with AsyncSessionLocal() as db:
        for sector, palabras in SECTORES.items():
            if current_count >= MAX_DAILY_CV: break

            for ciudad in CIUDADES:
                if current_count >= MAX_DAILY_CV: break

                keyword = random.choice(palabras)
                query = f'filetype:pdf "{keyword}" "{ciudad}" "España" after:{hace_un_ano} intitle:cv -Ecuador -Perú -Colombia -México -Argentina -Chile'

                print(f"\n[BUSCANDO] Sector: {sector} en {ciudad}...")

                # IMPORTANTE: Aquí pasamos el HEADLESS_MODE
                pdfs_en_memoria = await search_google_pdfs(query, headless=HEADLESS_MODE) 

                if not pdfs_en_memoria:
                    continue

                for pdf_item in pdfs_en_memoria:
                    if current_count >= MAX_DAILY_CV: break

                    try:
                        data = await extract_pdf_data(pdf_item["bytes"])
                    except AILimitReachedError:
                        print("\n[APAGADO DE EMERGENCIA] La IA ha bloqueado el acceso 3 veces seguidas.")
                        return 

                    if data and isinstance(data, dict) and data.get('first_name'):

                        linkedin = await search_linkedin_url(data.get('first_name'), data.get('last_name'))

                        f_name = str(data.get('first_name') or 'candidato').replace(' ', '').lower()
                        l_name = str(data.get('last_name') or 'anonimo').replace(' ', '').lower()
                        email_inventado = f"{f_name}.{l_name}@scraping.local"

                        candidate_data = {
                            "first_name": data.get('first_name'),
                            "last_name": data.get('last_name'),
                            "email": data.get('email') or email_inventado,
                            "phone": data.get('phone'),
                            "location": data.get('location'),
                            "source": f"Google PDF - {sector}",
                            "experience": str(data.get('experience')) if data.get('experience') else None,
                            "candidate_url": linkedin,
                            "cv_url": pdf_item['url'], 
                            "skills": str(data.get('skills')) if data.get('skills') else None,
                            "status": "active"
                        }

                        all_extracted_candidates.append(candidate_data)
                        current_count += 1
                        update_daily_limit(current_count)
                        guardado = await upsert_scraped_candidate(db, candidate_data)
                        if guardado:
                            print(f"  -> {data.get('first_name')} guardado corrctamente")
                        else:
                            print(f"Error guardadon a {data.get('firs_name')} en la BD")
                            
                        print(f"  -> {data.get('first_name')} añadido a la lista ({current_count}/{MAX_DAILY_CV})")

                    await asyncio.sleep(5) # Pausa cortés

        if current_count >= MAX_DAILY_CV:
            print("\n[FIN] Límite de currículums alcanzado por hoy. Buen trabajo.")

        return all_extracted_candidates

if __name__ == "__main__":
    asyncio.run(extract_pdfs_google())