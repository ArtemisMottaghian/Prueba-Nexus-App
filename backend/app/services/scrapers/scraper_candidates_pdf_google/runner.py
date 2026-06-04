import asyncio
import os
import json
import re
import aiohttp
import fitz
import uuid  # NUEVO: Para crear nombres de archivo únicos
from datetime import datetime
from google import genai  
from dotenv import load_dotenv

from sqlalchemy import select
from app.models.scraper_keyword_model import ScraperKeyword
from app.db.session import AsyncSessionLocal
from .utils import upsert_scraped_candidate
from app.core.scraper_candidates_pdf_config import MAX_PROFILES_PER_SEARCH
from .browser import search_brave_pdfs

load_dotenv(override=True)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

LIMIT_FILE = "daily_limit.json"
# 🛠️ NUEVO: Definimos la carpeta donde se guardarán los PDFs
CV_STORAGE_DIR = os.path.join(os.getcwd(), "stored_cvs")

# Aseguramos que la carpeta existe al arrancar
os.makedirs(CV_STORAGE_DIR, exist_ok=True)

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
        
async def search_linkedin_url(first_name: str, last_name: str) -> str | None:
    if not first_name or len(first_name) < 2:
        return None
    print(f" Buscando LinkedIn con API para {first_name} {last_name}")
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key: return None
    
    query = f'"{first_name} {last_name}" España site:linkedin.com/in/'
    headers = {"Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": api_key}
    search_url = "https://api.search.brave.com/res/v1/web/search"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(search_url, headers=headers, params={"q": query, "count": 5}, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    results = data.get("web", {}).get("results", [])
                    for item in results:
                        url = item.get("url", "")
                        if "linkedin.com/in/" in url:
                            print(f"LinkedIn encontrado: {url}")
                            return url
                    print("La búsqueda no devolvió ningún perfil")
                else:
                    print(f"Error en la API: {resp.status}")
    except Exception as e:
        print(f"Error de conexión: {e}")
        
async def extract_pdf_data(pdf_bytes: bytes, keyword: str) -> dict | None:
    try:
        text = ""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc: 
                text += page.get_text()
                
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) < 100: return None
        
        prompt = f"""
        Actúa como un reclutador experto y analiza este CV.
        Estamos buscando específicamente perfiles relacionados con la palabra clave: "{keyword}".
        REGLA DE ORO 1 (Ubicación): Solo nos interesan candidatos cuya residencia actual sea en España. 
        Si el currículum indica que vive en otro país (ej: Ecuador, Colombia, Perú, Argentina, México, etc.), devuelve exactamente esto y nada más: {{}}
        REGLA DE ORO 2 (Calidad): El perfil principal del candidato DEBE estar directamente relacionado con "{keyword}". 
        Si la palabra aparece solo como una anécdota, o el perfil principal del candidato no tiene sentido con lo que buscamos, devuelve exactamente esto y nada más: {{}}
        Si pasa ambas reglas de oro, devuelve SOLO un JSON estricto con: first_name, last_name, email, phone, location, sector, experience, education, skills, linkedin. 
        Texto: {text[:6000]}
        """
        
        for intento_gemini in range(4):
            try:
                response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                parsed_data = json.loads(clean_json)
                
                if not parsed_data:
                    print(f"CV descartado no cumple requisitos para: {keyword}")
                    return None
                
                print("Extraído con éxito usando Gemini (Plan Gratuito)")
                if isinstance(parsed_data, list) and len(parsed_data) > 0:
                    return parsed_data[0]
                return parsed_data if parsed_data else None
            
            except Exception as gemini_error:
                error_str = str(gemini_error)
                if "503" in error_str or "UNAVAILABLE" in error_str:
                    espera = 10 + (intento_gemini * 5)
                    print(f"⚠️ Servidor de Gemini saturado (503). Reintentando en {espera} segundos...")
                    await asyncio.sleep(espera)
                elif "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    espera = 30 + (intento_gemini * 15)
                    print(f"🛑 Límite de velocidad excedido (429). Esperando {espera} segundos...")
                    await asyncio.sleep(espera)
                else:
                    print(f"❌ Gemini falló por otro error: {gemini_error}")
                    break
                    
        return None
            
    except Exception as e:
        print(f"Error general procesando PDF: {e}")
        return None
    
async def extract_pdf() -> list[dict]:
    all_extracted_candidates = []
    current_count, today_str = check_daily_limit()
    
    if current_count >= MAX_PROFILES_PER_SEARCH:
        print(f"Límite diario alcanzado ({MAX_PROFILES_PER_SEARCH}/100) para hoy {today_str}")
        return all_extracted_candidates
    
    print(f"\n--- RECOLECTOR PRO INICIADO CON GEMINI: Llevamos {current_count}/{MAX_PROFILES_PER_SEARCH} procesados hoy. ---")
    
    async with AsyncSessionLocal() as db:
        kw_query = await db.execute(
            select(ScraperKeyword.keyword)
            .where(ScraperKeyword.is_active == True, ScraperKeyword.type == "keyword")
        )
        list_keyword = kw_query.scalars().all()
        
        city_query = await db.execute(
            select(ScraperKeyword.keyword)
            .where(ScraperKeyword.is_active == True, ScraperKeyword.type == "city")
        )
        city_list = city_query.scalars().all()
        
        if not list_keyword:
            print("No hay 'keywords' activas en la BD. Abortando")
            return []
        if not city_list:
            city_list = [""]
            
        for kw in list_keyword:
            if current_count >= MAX_PROFILES_PER_SEARCH: break
            for c in city_list:
                if current_count >= MAX_PROFILES_PER_SEARCH: break
                
                str_city = f'"{c}" ' if c else ""
                query = f'filetype:pdf "{kw}" (cv OR "curriculum vitae") {str_city} España -oferta -empleo -requisitos'
                print(f"\n[BUSCANDO] Query API: {query}")
                pdfs_in_memory = await search_brave_pdfs(query)
                
                if not pdfs_in_memory:
                    print(f"La API de Brave no encontró resultados")
                    continue
                
                for pdf_item in pdfs_in_memory:
                    if current_count >= MAX_PROFILES_PER_SEARCH: break
                    
                    print("⏳ Respiro de seguridad regulado (Garantizando un máx de 5 RPM)...")
                    await asyncio.sleep(12)
                    
                    try:
                        data = await extract_pdf_data(pdf_item["bytes"], kw)
                    except AILimitReachedError:
                        print("Apagado de emergencia, la IA ha bloqueado el acceso")
                        return all_extracted_candidates
                    
                    if data and isinstance(data, dict) and data.get('first_name'):
                        linkedin = data.get('linkedin')
                        if linkedin:
                            print(f"LinkedIn extraído directamente del CV: {linkedin}")
                        if not linkedin:
                            linkedin = await search_linkedin_url(data.get('first_name'), data.get('last_name'))
                            
                        f_name = str(data.get('first_name') or 'candidato').replace(' ', '').lower()
                        l_name = str(data.get('last_name') or 'anonimo').replace(' ', '').lower()
                        email_inventado = f"{f_name}.{l_name}@scraping.local"
                        
                        origen_bd = f"Brave API - {kw}"
                        if c: origen_bd += f" ({c})"

                        def limpiar_lista(valor):
                            if not valor: return None
                            if isinstance(valor, list):
                                return ", ".join(str(v) for v in valor)
                            return str(valor)

                        # 🛠️ NUEVO: Guardar el archivo PDF físicamente
                        # Generamos un nombre único: carlos_perez_a1b2c3d4.pdf
                        safe_f = re.sub(r'[^a-z0-9]', '', f_name)
                        safe_l = re.sub(r'[^a-z0-9]', '', l_name)
                        unique_id = uuid.uuid4().hex[:8]
                        filename = f"{safe_f}_{safe_l}_{unique_id}.pdf"
                        file_path = os.path.join(CV_STORAGE_DIR, filename)
                        
                        try:
                            with open(file_path, "wb") as f:
                                f.write(pdf_item["bytes"])
                            print(f"💾 PDF guardado en disco: {filename}")
                            # Guardamos la ruta relativa para la base de datos
                            cv_url_bd = f"/stored_cvs/{filename}"
                        except Exception as e:
                            print(f"⚠️ Error al guardar el PDF físico: {e}")
                            # Fallback de seguridad: guardamos la URL original de Brave
                            cv_url_bd = pdf_item['url']

                        candidate_data = {
                            "first_name": data.get('first_name'),
                            "last_name": data.get('last_name'),
                            "email": data.get('email') or email_inventado,
                            "phone": data.get('phone'),
                            "location": data.get('location'),
                            "source": origen_bd,
                            "experience": limpiar_lista(data.get('experience')),
                            "education": limpiar_lista(data.get('education')),
                            "candidate_url": linkedin,
                            "cv_url": cv_url_bd, # 🔥 AQUÍ SE GUARDA LA RUTA DEL ARCHIVO
                            "skills": limpiar_lista(data.get('skills')),
                            "status": "active"
                        }
                        
                        all_extracted_candidates.append(candidate_data)
                        current_count += 1
                        update_daily_limit(current_count)
                        
                        save = await upsert_scraped_candidate(db, candidate_data)
                        if save:
                            print(f"  -> {data.get('first_name')} guardado correctamente")
                        else:
                            print(f"  -> Error guardando a {data.get('first_name')} en la BD")
                            
                        print(f"  -> {data.get('first_name')} añadido a la lista ({current_count}/{MAX_PROFILES_PER_SEARCH})")
                    
                    await asyncio.sleep(2)
                
                if current_count >= MAX_PROFILES_PER_SEARCH:
                    print(f"Límite de CV alcanzado por hoy")
                    return all_extracted_candidates
        return all_extracted_candidates
            
if __name__ == "__main__":
    asyncio.run(extract_pdf())