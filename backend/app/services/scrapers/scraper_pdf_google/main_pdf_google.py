import asyncio
import os
import json
import random
import re
import urllib.parse
from datetime import datetime, timedelta

import aiohttp
import fitz  
from google import genai 
from dotenv import load_dotenv

from app.db.session import AsyncSessionLocal
from app.services.scrapers.scraper_pdf_google.scraper_repository import upsert_scraped_candidate
from app.core.scraper_pdf_config import SECTORES, CIUDADES
from .browser import search_google_pdfs 

# ==============================================================================
# INICIALIZACIÓN Y CONFIGURACIÓN
# ==============================================================================
load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_AI_KEY"))

LIMIT_FILE = "daily_limit.json"
MAX_DAILY_CV = 100

def check_daily_limit():
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

def update_daily_limit(count):
    today = datetime.now().strftime("%Y-%m-%d")
    with open(LIMIT_FILE, "w") as f:
        json.dump({"date": today, "count": count}, f)

# ==============================================================================
# 1. EL DETECTIVE DE LINKEDIN (Francotirador)
# ==============================================================================
async def search_linkedin_url(first_name, last_name):
    if not first_name or len(first_name) < 2: return None
    
    query = urllib.parse.quote_plus(f'{first_name} {last_name} España site:linkedin.com/in/')
    url = f"https://es.search.yahoo.com/search?p={query}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=6) as resp:
                if resp.status == 200:
                    html = urllib.parse.unquote(await resp.text())
                    match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', html, re.IGNORECASE)
                    if match: return match.group(1)
    except Exception: pass
    return None

# ==============================================================================
# 2. EL LECTOR IA (Con filtro estricto de país)
# ==============================================================================
async def extract_pdf_data(pdf_bytes):
    try:
        text = ""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc: text += page.get_text()
            
        if len(text) < 100: return None

        prompt = f"""
        Analiza este CV. 
        REGLA DE ORO: Solo nos interesan candidatos cuya residencia actual sea en España. Si el currículum indica que vive en otro país (ej: Ecuador, Colombia, Perú, etc.), devuelve exactamente esto y nada más: {{}}
        
        Si reside en España, devuelve SOLO un JSON estricto con: first_name, last_name, email, phone, location, sector, experience, skills. 
        Texto: {text[:6000]}
        """
        
        for intento in range(3):
            try:
                response = client.models.generate_content(model="gemini-3-flash-preview", contents=prompt)
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                parsed_data = json.loads(clean_json)
                
                if isinstance(parsed_data, list) and len(parsed_data) > 0:
                    return parsed_data[0]
                return parsed_data
                
            except Exception as api_error:
                error_str = str(api_error)
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    print("Límite de IA alcanzado. Frenando 15 segundos...")
                    await asyncio.sleep(15)
                elif "503" in error_str or "UNAVAILABLE" in error_str:
                    espera = 2 ** intento
                    print(f"Servidor IA saturado. Reintentando en {espera}s...")
                    await asyncio.sleep(espera)
                else:
                    return None
        return None
    except Exception as e:
        print(f" Error leyendo PDF: {e}")
        return None

# ==============================================================================
# 3. MOTOR PRINCIPAL
# ==============================================================================
async def run_pdf_scraper():
    current_count, today_str = check_daily_limit()
    
    if current_count >= MAX_DAILY_CV:
        print(f" Límite diario alcanzado ({MAX_DAILY_CV}/100) para hoy {today_str}. Vuelve mañana.")
        return

    # Filtro de antigüedad: restamos 365 días a la fecha actual para que busque CVs del último año
    hace_un_ano = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    
    print(f"\n RECOLECTOR PRO INICIADO: Llevamos {current_count}/{MAX_DAILY_CV} procesados hoy.")
    print(f" Solo buscando CVs indexados después de: {hace_un_ano}")

    async with AsyncSessionLocal() as db:
        for sector, palabras in SECTORES.items():
            if current_count >= MAX_DAILY_CV: break
            
            for ciudad in CIUDADES:
                if current_count >= MAX_DAILY_CV: break
                
                keyword = random.choice(palabras)
                
                # LA BÚSQUEDA DE GOOGLE CON FILTRO DE FECHA Y RECHAZO DE EXTRANJEROS
                query = f'filetype:pdf "{keyword}" "{ciudad}" "España" after:{hace_un_ano} intitle:cv -Ecuador -Perú -Colombia -México -Argentina -Chile'
                
                print(f"\n Buscando {sector} en {ciudad} (Máx 1 año de antigüedad)...")
                
                pdfs_en_memoria = await search_google_pdfs(query) 
                
                if not pdfs_en_memoria:
                    continue

                for pdf_item in pdfs_en_memoria:
                    if current_count >= MAX_DAILY_CV: break
                    
                    data = await extract_pdf_data(pdf_item["bytes"])
                    
                    # Si la IA devuelve diccionario vacío {}, data.get('first_name') será False y lo saltará
                    if data and isinstance(data, dict) and data.get('first_name'):
                        
                        linkedin = await search_linkedin_url(data.get('first_name'), data.get('last_name'))
                        
                        # PREPARAMOS LOS DATOS
                        candidate_data = {
                            "first_name": data.get('first_name'),
                            "last_name": data.get('last_name'),
                            "email": data.get('email') or f"candidato_{random.randint(1000,99999)}@oculto.com",
                            "phone": data.get('phone'),
                            "location": data.get('location'),
                            "source": f"Google PDF - {sector}",
                            "experience": str(data.get('experience')) if data.get('experience') else None,
                            "candidate_url": linkedin or pdf_item['url'],
                            "cv_url": pdf_item['url'], 
                            "skills": str(data.get('skills')) if data.get('skills') else None,
                            "status": "active"
                        }
                        
                        # GUARDADO EN BBDD
                        try:
                            await upsert_scraped_candidate(db, candidate_data)
                            current_count += 1
                            update_daily_limit(current_count)
                            print(f" [{current_count}/{MAX_DAILY_CV}] ¡GUARDADO EN BBDD! -> {data.get('first_name')} {data.get('last_name')}")
                        except Exception as e:
                            print(f" Error al guardar en BBDD: {e}")
                    
                    # El respiro necesario para la IA y Google
                    print(" Pausa táctica de 15 segundos...")
                    await asyncio.sleep(15)
                    
        if current_count >= MAX_DAILY_CV:
            print("\n ¡Límite de 100 currículums alcanzado por hoy! Buen trabajo.")

if __name__ == "__main__":
    asyncio.run(run_pdf_scraper())