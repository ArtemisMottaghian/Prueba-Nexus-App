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
from app.core.scraper_candidates_pdf_config import SECTORES, CIUDADES, HEADLESS_MODE, KEYWORDS, MAX_PROFILES_PER_SEARCH
from .browser import search_google_pdfs, search_bing_pdfs


# INICIALIZACIÓN Y CONFIGURACIÓN

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_AI_KEY"))
# claude_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

LIMIT_FILE = "daily_limit.json"


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

    print(f"    Buscando LinkedIn para: {first_name} {last_name}...")

    # Preparamos la búsqueda para DuckDuckGo
    query = urllib.parse.quote_plus(f'"{first_name} {last_name}" España site:linkedin.com/in/')

    # Cabeceras premium para que DuckDuckGo nos trate como a un usuario normal
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    }
    
    regex_linkedin = r'(?:https?://)?(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[a-zA-Z0-9%_.-]+'

    # Intento con DuckduckGo
    url_ddg = f"https://html.duckduckgo.com/html/?q={query}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url_ddg, headers=headers, timeout=8) as resp:
                if resp.status == 200:
                    html = urllib.parse.unquote(await resp.text())
                    match = re.search(regex_linkedin, html, re.IGNORECASE)

                    if match: 
                        link = match.group(0)
                        print(f"LinkedIn encontrado desde duckduckgo: {link}")
                        return link
                else:
                    print(f"    DuckDuckGo bloqueó la búsqueda (Error {resp.status})")
    except Exception as e: 
        print(f"    Error de conexión con DuckDuckGo: {e}")

    # Intento con Yahoo
    print(f"Intentando con Yahoo para: {first_name} {last_name}")
    url_yahoo = f"https://es.search.yahoo.com/search?p={query}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url_yahoo, headers=headers, timeout=8) as resp:
                if resp.status == 200:
                    html = urllib.parse.unquote(await resp.text())
                    match = re.search(regex_linkedin, html, re.IGNORECASE)
                    
                    if match:
                        link = match.group(0)
                        if not link.startswith('http'): f"https://{link}"
                        print(f"LinkedIn encontrado en yahoo: {link}")
                        return link
                    else:
                        print("Yahoo no devolvio ningún perfil")
                else:
                    print(f"Yahoo bloqueo la búsqueda: {resp.status}")
    except Exception as e:
        print(f"Error de conexión: {e}")
    
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
        
        Si reside en España, devuelve SOLO un JSON estricto con: first_name, last_name, email, phone, location, sector, experience, education, skills. 
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

        return None

    except Exception as e:
        print(f"[ERROR] Error general procesando PDF: {e}")
        return None


# 3. MOTOR PRINCIPAL MODIFICADO (Solo Keywords)

async def extract_pdfs_google() -> list[dict]:
    """
    Orquesta la búsqueda de archivos PDF en Google basándose únicamente 
    en las palabras clave del archivo de configuración.
    """

    all_extracted_candidates = []
    current_count, today_str = check_daily_limit()

    if current_count >= MAX_PROFILES_PER_SEARCH:
        print(f"[INFO] Límite diario alcanzado ({MAX_PROFILES_PER_SEARCH}/100) para hoy {today_str}. Vuelve mañana.")
        return

    print(f"\n--- RECOLECTOR PRO INICIADO: Llevamos {current_count}/{MAX_PROFILES_PER_SEARCH} procesados hoy. ---")

    async with AsyncSessionLocal() as db:
        
        # Nos aseguramos de que sea una lista (por si pones solo un string en config)
        lista_keywords = KEYWORDS if isinstance(KEYWORDS, list) else [KEYWORDS]

        for keyword in lista_keywords:
            if current_count >= MAX_PROFILES_PER_SEARCH: 
                break 
            sector = "Búsqueda por Keyword" 
            
            # Buscamos la palabra clave estricta, forzando que sea PDF y parezca un CV
            query = f'filetype:pdf "{keyword}" (cv OR "curriculum vitae") España -oferta -empleo -requisitos'

            print(f"\n[BUSCANDO] Palabra clave: {query}...")

            # IMPORTANTE: Aquí pasamos el HEADLESS_MODE
            pdfs_en_memoria = await search_google_pdfs(query, headless=HEADLESS_MODE) 

            if not pdfs_en_memoria:
                print(f"    No se encontraron resultados en Google para {keyword}. Intentando con Bing")
                pdfs_en_memoria = await search_bing_pdfs(query, headless=HEADLESS_MODE)
                
            if not pdfs_en_memoria:
                print(f"Ni Google ni Bing encontraron resultados para: {keyword}")
                continue

            for pdf_item in pdfs_en_memoria:
                if current_count >= MAX_PROFILES_PER_SEARCH: break

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
                        "source": f"Google PDF - Keyword: {keyword}",
                        "experience": str(data.get('experience')) if data.get('experience') else None,
                        "education": str(data.get('education')) if data.get('education') else None,
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
                        print(f"  -> {data.get('first_name')} guardado correctamente")
                    else:
                        print(f"Error guardando a {data.get('first_name')} en la BD")
                        
                    print(f"  -> {data.get('first_name')} añadido a la lista ({current_count}/{MAX_PROFILES_PER_SEARCH})")

                await asyncio.sleep(5) # Pausa cortés

        if current_count >= MAX_PROFILES_PER_SEARCH:
            print("\n[FIN] Límite de currículums alcanzado por hoy. Buen trabajo.")

        return all_extracted_candidates

if __name__ == "__main__":
    asyncio.run(extract_pdfs_google())