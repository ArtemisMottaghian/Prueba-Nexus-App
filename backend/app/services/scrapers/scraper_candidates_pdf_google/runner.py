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

# Nuevos imports para Playwright y Stealth
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

from app.db.session import AsyncSessionLocal
from .utils import upsert_scraped_candidate
from app.core.scraper_candidates_pdf_config import SECTORES, CIUDADES, HEADLESS_MODE, KEYWORDS
from .browser import search_google_pdfs, search_bing_pdfs


# INICIALIZACIÓN Y CONFIGURACIÓN

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_AI_KEY"))

LIMIT_FILE = "daily_limit.json"
MAX_DAILY_CV = 6

class AILimitReachedError(Exception):
    pass

def check_daily_limit() -> tuple[int, str]:
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
    today = datetime.now().strftime("%Y-%m-%d")
    with open(LIMIT_FILE, "w") as f:
        json.dump({"date": today, "count": count}, f)


# 1. BUSCAR LINKEDIN (Capa Stealth con Bing)

async def search_linkedin_url(first_name: str, last_name: str) -> str | None:
    """Busca la URL de perfil de LinkedIn usando Playwright Stealth en Bing."""
    if not first_name or len(first_name) < 2: 
        return None

    print(f"    [BÚSQUEDA RED] Buscando LinkedIn en Bing para: {first_name} {last_name}...")

    query = f'"{first_name} {last_name}" España site:linkedin.com/in/'
    url = f"https://www.bing.com/search?q={urllib.parse.quote_plus(query)}"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,  # Para la búsqueda de linkedin, ser headless suele ser suficiente si usamos stealth
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                extra_http_headers={"Accept-Language": "es-ES,es;q=0.9"}
            )
            page = await context.new_page()
            
            # APLICAMOS STEALTH
            await Stealth().apply_stealth_async(page)

            await page.goto(url, wait_until="domcontentloaded", timeout=12000)
            await asyncio.sleep(2) 

            all_hrefs = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a'))
                            .map(a => a.href)
                            .filter(href => href && href.includes('linkedin.com/in/'));
            }""")

            await browser.close()

            for href in all_hrefs:
                if "linkedin.com/in/" in href:
                    print(f"    [BÚSQUEDA RED] ¡LinkedIn encontrado!: {href}")
                    return href

            print("    [BÚSQUEDA RED] Bing no devolvió ningún perfil.")
            
    except Exception as e: 
        print(f"    [BÚSQUEDA RED] Error de conexión con Bing: {e}")

    return None


# 2. EL LECTOR IA

async def extract_pdf_data(pdf_bytes: bytes) -> dict | None:
    """Extrae el texto y lo estructura en JSON (incluyendo education y linkedin)."""
    try:
        text = ""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc: text += page.get_text()

        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) < 100: return None

        prompt = f"""
        Analiza este CV. 
        REGLA DE ORO: Solo nos interesan candidatos cuya residencia actual sea en España. Si el currículum indica que vive en otro país (ej: Ecuador, Colombia, Perú, etc.), devuelve exactamente esto y nada más: {{}}
        
        Si reside en España, devuelve SOLO un JSON estricto con: first_name, last_name, email, phone, location, sector, experience, education, skills, linkedin. 
        Texto: {text[:6000]}
        """

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
                    espera = 40 + (intento_gemini * 10) 
                    print(f"    Límite de Gemini alcanzado. Esperando {espera} segundos...")
                    await asyncio.sleep(espera)
                else:
                    print(f"    Gemini falló por otro error. {gemini_error}")
                    break 

        return None

    except Exception as e:
        print(f"[ERROR] Error general procesando PDF: {e}")
        return None


# 3. MOTOR PRINCIPAL 

async def extract_pdfs_google() -> list[dict]:
    all_extracted_candidates = []
    current_count, today_str = check_daily_limit()

    if current_count >= MAX_DAILY_CV:
        print(f"[INFO] Límite diario alcanzado ({MAX_DAILY_CV}/100) para hoy {today_str}. Vuelve mañana.")
        return

    print(f"\n--- RECOLECTOR PRO INICIADO: Llevamos {current_count}/{MAX_DAILY_CV} procesados hoy. ---")

    async with AsyncSessionLocal() as db:
        
        lista_keywords = KEYWORDS if isinstance(KEYWORDS, list) else [KEYWORDS]

        for keyword in lista_keywords:
            if current_count >= MAX_DAILY_CV: break 
            
            # La Query Ninja
            query = f'filetype:pdf "{keyword}" (cv OR "curriculum vitae") España -oferta -empleo -requisitos'

            print(f"\n[BUSCANDO] Query: {query}...")

            # 1. Google con Stealth
            pdfs_en_memoria = await search_google_pdfs(query, headless=HEADLESS_MODE) 

            # 2. Bing con Stealth (Si falla Google)
            if not pdfs_en_memoria:
                print(f"    [!] Google no devolvió resultados. Intentando con Bing...")
                pdfs_en_memoria = await search_bing_pdfs(query, headless=HEADLESS_MODE)

            if not pdfs_en_memoria:
                print(f"    [X] Ni Google ni Bing encontraron resultados válidos para: {keyword}.")
                continue

            for pdf_item in pdfs_en_memoria:
                if current_count >= MAX_DAILY_CV: break

                try:
                    data = await extract_pdf_data(pdf_item["bytes"])
                except AILimitReachedError:
                    print("\n[APAGADO DE EMERGENCIA] La IA ha bloqueado el acceso.")
                    return 

                if data and isinstance(data, dict) and data.get('first_name'):

                    # Prioridad 1: Gemini extrajo el LinkedIn del PDF
                    linkedin = data.get('linkedin')
                    if linkedin:
                        print(f"    [GEMINI] LinkedIn extraído directamente del CV: {linkedin}")

                    # Prioridad 2: Buscar en la red si no estaba en el PDF
                    if not linkedin:
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
                        
                    print(f"  -> {data.get('first_name')} añadido a la lista ({current_count}/{MAX_DAILY_CV})")

                await asyncio.sleep(5) 

        if current_count >= MAX_DAILY_CV:
            print("\n[FIN] Límite de currículums alcanzado por hoy. Buen trabajo.")

        return all_extracted_candidates

if __name__ == "__main__":
    asyncio.run(extract_pdfs_google())