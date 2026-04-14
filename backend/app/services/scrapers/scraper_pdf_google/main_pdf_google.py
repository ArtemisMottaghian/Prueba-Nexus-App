import asyncio
import os
import random
import re
import urllib.parse
import aiohttp
from dotenv import load_dotenv

from app.core.scraper_pdf_config import SECTORES, CIUDADES
from .browser import search_google_pdfs 
import fitz  
from google import genai 
import json

# IMPORTACIONES PARA GUARDAR EN LA BASE DE DATOS
from app.db.session import AsyncSessionLocal
from app.services.scrapers.scraper_pdf_google.scraper_repository import upsert_scraped_candidate

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_AI_KEY"))

# ==============================================================================
# 1. EL DETECTIVE DE LINKEDIN
# ==============================================================================
async def search_linkedin_url(first_name, last_name):
    if not first_name or len(first_name) < 2: return None
    
    # 1. Búsqueda sin comillas estrictas para permitir segundos nombres o falta de tildes
    # Añadimos la palabra "España" para centrar el tiro (puedes quitarlo si buscas perfiles internacionales)
    query = urllib.parse.quote_plus(f'{first_name} {last_name} España site:linkedin.com/in/')
    url = f"https://es.search.yahoo.com/search?p={query}"
    
    # Cabeceras más completas para parecer un humano real navegando por Yahoo
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=8) as resp:
                if resp.status == 200:
                    # Leemos la web de Yahoo
                    html = await resp.text()
                    
                    # Descodificamos por si Yahoo ha envuelto el enlace con sus propios códigos
                    html_decoded = urllib.parse.unquote(html)
                    
                    # 2. Expresión regular mejorada: 
                    # Corta exactamente en el nombre de usuario, ignorando interrogaciones o parámetros extra
                    match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', html_decoded, re.IGNORECASE)
                    
                    if match: 
                        enlace_limpio = match.group(1)
                        return enlace_limpio
                        
    except Exception as e:
        print(f" Error interno en el detective: {e}")
        pass
        
    return None

# ==============================================================================
# 2. EXTRACTOR CON IA 
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
                    print(" Límite de IA alcanzado. Frenando 15 segundos...")
                    await asyncio.sleep(15)
                elif "503" in error_str or "UNAVAILABLE" in error_str:
                    espera = 2 ** intento
                    print(f" Servidor IA saturado. Reintentando en {espera}s...")
                    await asyncio.sleep(espera)
                else:
                    print(f" Error IA: {error_str}")
                    return None
        return None
    except Exception as e:
        print(f" Error leyendo PDF: {e}")
        return None

# ==============================================================================
# 3. MOTOR PRINCIPAL
# ==============================================================================
async def run_pdf_scraper():
    print("\n---  MODO RECOLECTOR ACTIVO: EXTRACCIÓN Y GUARDADO EN BBDD ---")
    contador = 0
    limite = 100
    
    # ABRIMOS LA CONEXIÓN A LA BASE DE DATOS
    async with AsyncSessionLocal() as db:
        for sector, palabras in SECTORES.items():
            if contador >= limite: break
            
            for ciudad in CIUDADES:
                if contador >= limite: break
                
                keyword = random.choice(palabras)
                query = f'filetype:pdf "{keyword}" "{ciudad}" "España" intitle:cv -Ecuador -Perú -Colombia -México -Argentina -Chile'
                print(f"\n Buscando {sector} en {ciudad}...")
                
                pdfs_en_memoria = await search_google_pdfs(query) 
                
                if not pdfs_en_memoria:
                    continue

                for pdf_item in pdfs_en_memoria:
                    if contador >= limite: break
                    
                    data = await extract_pdf_data(pdf_item["bytes"])
                    
                    if data and isinstance(data, dict) and data.get('first_name'):
                        linkedin = await search_linkedin_url(data.get('first_name'), data.get('last_name'))
                        
                        # PREPARAMOS EL DICCIONARIO PARA TU REPOSITORIO
                        candidate_data = {
                            "first_name": data.get('first_name'),
                            "last_name": data.get('last_name'),
                            # Si no hay email, creamos uno falso para que no de error la BD
                            "email": data.get('email') or f"candidato_{random.randint(1000,99999)}@oculto.com",
                            "phone": data.get('phone'),
                            "location": data.get('location'),
                            "source": f"Google PDF - {sector}",
                            "experience": str(data.get('experience')) if data.get('experience') else None,
                            "candidate_url": linkedin or pdf_item['url'],
                            "cv_url": pdf_item['url'], # ¡Guardamos el enlace real del PDF!
                            "skills": str(data.get('skills')) if data.get('skills') else None,
                            "status": "active"
                        }
                        
                        # GUARDAMOS EN LA BBDD
                        try:
                            await upsert_scraped_candidate(db, candidate_data)
                            print(f" ¡GUARDADO EN BBDD! -> {data.get('first_name')} {data.get('last_name')}")
                        except Exception as e:
                            print(f"⚠️ Error al guardar en BBDD: {e}")
                        
                        contador += 1
                    
                    print(" Pausa táctica de 12 segundos...")
                    await asyncio.sleep(12)

if __name__ == "__main__":
    asyncio.run(run_pdf_scraper())