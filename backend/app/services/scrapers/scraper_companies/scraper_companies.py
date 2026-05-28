import asyncio
import json
import os
import requests
import warnings
import time
import random
import urllib.parse
import re
import traceback
from app.db.session import AsyncSessionLocal
from bs4 import BeautifulSoup
from sqlalchemy import text
warnings.filterwarnings("ignore", category=FutureWarning)
import google.generativeai as genai

# 2. Silenciamos DEFINITIVAMENTE el aviso de InsecureRequestWarning de requests
requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())
from datetime import datetime
from app.core.scraper_companies_config import DB_CONFIG
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

os.environ["PGCLIENTENCODING"] = "utf-8"

if not GEMINI_API_KEY:
    print("[ERROR CRÍTICO] No se ha encontrado GEMINI_API_KEY en el .env.")
else:
    print("[OK] API KEY de Gemini cargada correctamente.")
    genai.configure(api_key=GEMINI_API_KEY)


# ==========================================
# 1. SCRAPERS MERCANTILES Y ESCÁNER WEB
# ==========================================
def buscar_cif_en_web_oficial(dominio: str) -> str:
    """Entra en la web de la empresa para robar el CIF o NIF."""
    if not dominio or dominio == "Desconocida":
        return None
        
    print(f"   -> [NUEVO] Escaneando la web oficial y legales de ({dominio})...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}
    
    rutas_a_probar = [
        f"https://{dominio}", 
        f"https://{dominio}/aviso-legal", 
        f"https://{dominio}/legal",
        f"https://{dominio}/politica-de-privacidad"
    ]
    
    # REGEX MAESTRA ESPAÑOLA:
    # 1. [A-Z][\-\s]?\d{7}[\-\s]?[A-Z0-9] -> CIF normal y de Ayuntamientos (Ej: B12345678, P1707900B)
    # 2. \d{8}[\-\s]?[A-Z] -> NIF/DNI normal de autónomos (Ej: 12345678A)
    # 3. [XYZ][\-\s]?\d{7}[\-\s]?[A-Z] -> NIE de extranjeros (Ej: X1234567A)
    patron_fiscal = r'\b(?:[A-Z][\-\s]?\d{7}[\-\s]?[A-Z0-9]|\d{8}[\-\s]?[A-Z])\b'
    
    for url in rutas_a_probar:
        try:
            response = requests.get(url, headers=headers, timeout=5, verify=False)
            
            # Buscamos nuestra super-fórmula en el texto
            match_cif = re.search(patron_fiscal, response.text, re.IGNORECASE) 
            if match_cif:
                cif_limpio = match_cif.group().replace("-", "").replace(" ", "").upper()
                print(f"   -> [ÉXITO WEB] NIF/CIF encontrado en ruta: {url} -> {cif_limpio}")
                return cif_limpio
        except Exception:
            continue
            
    return None

def buscar_cif_directorios_alternativos(nombre_empresa: str) -> dict:
    """Busca el CIF/NIF enfocandose en datoscif.es usando DuckDuckGo."""
    print(f"   -> [PLAN B] Buscando CIF/NIF en datoscif.es...")
    datos_mercantiles = {"cif": None, "address": None}
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}
    
    # Limpiamos el nombre para que el buscador no se confunda
    nombre_limpio = re.sub(r'[^a-zA-Z0-9\s]', '', nombre_empresa)
    
    try:
        # Apuntamos directamente al nuevo dominio que has propuesto
        query = urllib.parse.quote(f'"{nombre_limpio}" (CIF OR NIF) site:datoscif.es')
        url_busqueda = f"https://html.duckduckgo.com/html/?q={query}"
        
        response = requests.get(url_busqueda, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Aplicamos la Regex Maestra en los resultados
        patron_fiscal = r'\b(?:[A-Z][\-\s]?\d{7}[\-\s]?[A-Z0-9]|\d{8}[\-\s]?[A-Z])\b'
        match_cif = re.search(patron_fiscal, soup.get_text(), re.IGNORECASE)
        
        if match_cif:
            cif_limpio = match_cif.group().replace("-", "").replace(" ", "").upper()
            datos_mercantiles["cif"] = cif_limpio
            print(f"   -> [EXITO DIRECTORIO] NIF/CIF rescatado desde datoscif.es: {cif_limpio}")
            
    except Exception as e:
        pass
        
    return datos_mercantiles

def search_description_in_browser(url: str) -> str:
    """
    Entra directamente en la web oficial de la empresa y extrae su descripción
    o los primeros párrafos útiles para entender a qué se dedican.
    """
    if not url or url.lower() == 'desconocida':
        return ""
        
    # Asegurarnos de que la URL tiene formato válido
    if not url.startswith("http"):
        url = "https://" + url
        
    print(f"   -> [WEB OFICIAL] Extrayendo información directamente de {url}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        # Hacemos la petición a la web oficial con un límite de 10 segundos
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return ""
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # ESTRATEGIA 1: Buscar la etiqueta "meta description" (suele ser el resumen perfecto)
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            print("   -> [WEB OFICIAL] ¡Meta descripción encontrada con éxito!")
            return meta_desc.get('content')
            
        # ESTRATEGIA 2: Si no hay meta, cogemos los primeros 3 párrafos con contenido real
        parrafos = soup.find_all('p')
        textos_utiles = []
        
        for p in parrafos:
            texto = p.get_text(strip=True)
            # Filtramos párrafos muy cortos que suelen ser menús o botones (ej. "Aceptar cookies")
            if len(texto) > 40: 
                textos_utiles.append(texto)
                if len(textos_utiles) == 3: # Con 3 párrafos la IA tiene de sobra
                    break
                    
        if textos_utiles:
            print("   -> [WEB OFICIAL] Párrafos de texto extraídos con éxito.")
            return " ".join(textos_utiles)
            
    except Exception as e:
        # Si la web tarda mucho o bloquea, fallamos silenciosamente
        print(f"   -> [AVISO] No se pudo leer la web oficial ({url}): {str(e)[:40]}")
        
    return ""

# ==========================================
# 2. MOTOR DE EXTRACCIÓN (PIPELINE HÍBRIDO)
# ==========================================
def extract_company_data(raw_text: str, basic_company_name: str) -> dict:
    print(f"\n   -> Iniciando cadena para: {basic_company_name}")
    nombre_limpio = basic_company_name
    
    # --- PASO 1: CLEARBIT ---
    print(f"   -> [1/3] Buscando web oficial (Clearbit)...")
    website_clearbit = None
    try:
        url = f"https://autocomplete.clearbit.com/v1/companies/suggest?query={basic_company_name}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200 and response.json():
            mejor_resultado = response.json()[0]
            website_clearbit = mejor_resultado.get("domain")
            nombre_limpio = mejor_resultado.get("name", basic_company_name)
    except:
        pass

    # --- PASO 2: OBTENER CIF (Escáner Web + Directorios) ---
    cif_encontrado = None
    dir_encontrada = None
    
    # Intento 1: Escanear su propia web (Si Clearbit la encontró)
    if website_clearbit:
        cif_encontrado = buscar_cif_en_web_oficial(website_clearbit)
        
    # Intento 2: Si no lo encontró en la web, vamos a los directorios
    if not cif_encontrado:
        time.sleep(random.uniform(2.0, 4.0)) # Pausa anti-bot
        datos_directorios = buscar_cif_directorios_alternativos(nombre_limpio)
        cif_encontrado = datos_directorios.get("cif")

    info_extra_internet = ""
    if website_clearbit and website_clearbit != 'Desconocida':
        info_extra_internet = search_description_in_browser(website_clearbit)
    
    # --- PASO 3: GEMINI ---
    print(f"   -> [3/3] Pasando datos a Gemini para consolidar...")
    if not GEMINI_API_KEY:
         return {"name": nombre_limpio, "cif": cif_encontrado, "sector": None, "website": website_clearbit, "linkedin_url": None, "address": "Provincia/Pais no especificado", "contact_email": None, "contact_phone": None}

    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    Actúa como investigador B2B. Oferta de la empresa "{nombre_limpio}".
    Datos previos encontrados:
    - Web: {website_clearbit if website_clearbit else 'Desconocida'}
    - CIF: {cif_encontrado if cif_encontrado else 'Desconocido'}
    - Dirección Legal: {dir_encontrada if dir_encontrada else 'Desconocida'}
    - Internet: {info_extra_internet if info_extra_internet else 'Ninguna'}
    
    Texto de la oferta original: {raw_text}

    Devuelve ÚNICAMENTE un JSON con estas claves exactas:
    - "name": "{nombre_limpio}"
    - "company_description": (OBLIGATORIO. Escribe a qué se dedica la empresa. Usa los datos o TU CONOCIMIENTO INTERNO. ESTÁ ESTRICTAMENTE PROHIBIDO devolver null. Si es 100% desconocida, inventa un resumen genérico basado en la vacante, ej: 'Empresa contratante en el sector X buscando incorporar talento').
    - "website": (usa la web dada o dedúcela)
    - "cif": (Si te he dado un CIF, úsalo. Si es 'Desconocido', deduce el CIF/NIF real en España OBLIGATORIAMENTE. Si es extranjera sin sede fiscal, pon null).
    - "address": (Usa la dirección dada. Si no la tienes, deduce OBLIGATORIAMENTE Provincia y País, nunca null)
    - "sector": (OBLIGATORIO deducirlo)
    - "linkedin_url": (OBLIGATORIO deducirlo)
    - "contact_email": (SOLO si aparece en el texto, si no null)
    - "contact_phone": (SOLO si aparece en el texto, si no null)
    """
    
    try:  
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        
        print(f"La IA devolvio esta descripción: {data.get('company_description')}")

        claves_requeridas = ["name", "company_description", "website", "cif", "address", "sector", "linkedin_url", "contact_email", "contact_phone"]
        for clave in claves_requeridas:
            if clave not in data:
                if clave == "address":
                    data[clave] = "Provincia/Pais no especificado"
                else:
                    data[clave] = None
        
        # Segundo chequeo por si Gemini si puso la clave pero con valor null
        if not data.get("address"):
            data["address"] = "Provincia/Pais no especificado"
                
        print(f"   -> Datos consolidados por IA.")
        return data
        
    except Exception as e:
        print(f"   -> Fallo en Gemini: {str(e)[:50]}")
        return {
            "name": nombre_limpio, "cif": cif_encontrado, "sector": None, 
            "website": website_clearbit, "linkedin_url": None, 
            "address": dir_encontrada if dir_encontrada else "Provincia/Pais no especificado", 
            "contact_email": None, "contact_phone": None
        }


# ==========================================
# 3. LÓGICA DE BBDD 
# ==========================================
async def upsert_company(db_session, company_data: dict) -> int | None:
    try:
        # --- PASO 1: EMPRESA ---
        query_company = text("""
            INSERT INTO companies (
                name, company_description, cif, sector, website, linkedin_url, address, original_offer_id, updated_at
            ) VALUES (
                :name, :company_description, :cif, :sector, :website, :linkedin_url, :address, :original_offer_id, CURRENT_TIMESTAMP
            )
            ON CONFLICT (name) 
            DO UPDATE SET 
                company_description = COALESCE(EXCLUDED.company_description, companies.company_description),
                cif = COALESCE(EXCLUDED.cif, companies.cif),
                sector = COALESCE(EXCLUDED.sector, companies.sector),
                website = COALESCE(EXCLUDED.website, companies.website),
                linkedin_url = COALESCE(EXCLUDED.linkedin_url, companies.linkedin_url),
                address = COALESCE(EXCLUDED.address, companies.address),
                original_offer_id = COALESCE(EXCLUDED.original_offer_id, companies.original_offer_id),
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
        """)
        
        safe_company = {
            "name": company_data.get("name") or "Empresa confidencial",
            "company_description": company_data.get("company_description"),
            "cif": company_data.get("cif"),
            "sector": company_data.get("sector"),
            "website": company_data.get("website"),
            "linkedin_url": company_data.get("linkedin_url"),
            "address": company_data.get("address", "Provincia/País no especificado"),
            "original_offer_id": company_data.get("original_offer_id")
        }
        
        result = await db_session.execute(query_company, safe_company)
        company_id = result.scalar()

        # --- PASO 2: CONTACTO ---
        fname = company_data.get("contact_first_name")
        lname = company_data.get("contact_last_name") or ""
        email = company_data.get("contact_email")
        phone = company_data.get("contact_phone")
        recruiter_linkedin = company_data.get("recruiter_url")
        
        if company_id and (fname or email):
            full_name = f"{fname} {lname}".strip() or "HR Departament"
            
            contact_data = {
                "company_id": company_id,
                "full_name": full_name,
                "email": email,
                "phone": phone,
                "linkedin_url": recruiter_linkedin
            }
            
            if email: 
                query_contact = text("""
                    INSERT INTO contacts (
                        company_id, full_name, email, phone, job_title, linkedin_url, last_interaction
                    ) VALUES (
                        :company_id, :full_name, :email, :phone, 'Recruiter', :linkedin_url, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (email)
                    DO UPDATE SET
                        full_name = COALESCE(EXCLUDED.full_name, contacts.full_name),
                        phone = COALESCE(EXCLUDED.phone, contacts.phone),
                        linkedin_url = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
                        last_interaction = CURRENT_TIMESTAMP;
                """)
                await db_session.execute(query_contact, contact_data)
            else:
                query_contact_no_email = text("""
                    INSERT INTO contacts (
                        company_id, full_name, email, phone, job_title, linkedin_url, last_interaction
                    ) VALUES (
                        :company_id, :full_name, :email, :phone, 'Recruiter', :linkedin_url, CURRENT_TIMESTAMP
                    )
                """)
                await db_session.execute(query_contact_no_email, contact_data)
        
        return company_id

    except Exception as e:
        print(f"Error UPSERT COMPANY: {e}")
        return None    

async def insert_job_offer(db_session, job_data: dict, company_id: int):
    job_data.pop("company_name", None)
    job_data.pop("company_description", None)
    job_data.pop("recruiter_name", None)
    job_data.pop("recruiter_email", None)
    job_data.pop("recruiter_phone", None)
    
    published_at_str = job_data.get("published_at")
    published_at_obj = None

    if published_at_str:
        try:
            fecha_limpia = str(published_at_str)[:10]
            published_at_obj = datetime.fromisoformat(fecha_limpia)
        except Exception as e:
            print(f" -> [AVISO] No se pudo convertir la fecha {published_at_str}: {e}")
            published_at_obj = None
            
    safe_job = {
        "portal_id": job_data.get("portal_id"),
        "company_id": company_id,
        "external_id": job_data.get("external_id"),
        "title": job_data.get("title"),
        "location": job_data.get("location"),
        "offer_url": job_data.get("offer_url"),
        "job_description": job_data.get("job_description"),
        "published_at": published_at_obj,  # <- Pasamos el objeto, no el texto
        "sector": job_data.get("sector"),
        "salary_min": job_data.get("salary_min"),
        "salary_max": job_data.get("salary_max"),
        "contract_type": job_data.get("contract_type"),
        "contract_time": job_data.get("contract_time"),
        "work_modality": job_data.get("work_modality"),
    }
    
    query = text("""
        INSERT INTO job_offers (
            portal_id, company_id, external_id, title, location, offer_url, 
            job_description, published_at, sector, salary_min, salary_max, 
            contract_type, contract_time, work_modality
        ) VALUES (
            :portal_id, :company_id, :external_id, :title, :location, :offer_url, 
            :job_description, :published_at, :sector, :salary_min, :salary_max, 
            :contract_type, :contract_time, :work_modality
        )
        ON CONFLICT(portal_id, external_id)
        DO UPDATE SET
            company_id = EXCLUDED.company_id,
            title = EXCLUDED.title,
            location = EXCLUDED.location,
            offer_url = EXCLUDED.offer_url,
            job_description = EXCLUDED.job_description,
            salary_min = EXCLUDED.salary_min,
            salary_max = EXCLUDED.salary_max,
            contract_type = EXCLUDED.contract_type,
            contract_time = EXCLUDED.contract_time,
            work_modality = EXCLUDED.work_modality,
            sector = EXCLUDED.sector
    """)
    await db_session.execute(query, safe_job)


# ==========================================
# 4. PUNTO DE ENTRADA 
# ==========================================
async def process_scraped_job(job_data: dict) -> bool:
    job_title = job_data.get("title", "Titulo Desconocido")
    basic_company_name = job_data.get("company_name", "Empresa Confidencial")
    scraped_html_text = job_data.get("job_description", "")
    
    print(f"\n--- Procesando vacante: {job_title} ---")
    
    company_data = await asyncio.to_thread(extract_company_data, scraped_html_text, basic_company_name)
    
    if not isinstance(company_data, dict):
        company_data = {}
        
    if not company_data.get("name"):
        company_data["name"] = basic_company_name
    
    desc_scraper = job_data.get("company_description")
    desc_ia = company_data.get("company_description")     
    company_data["company_description"] = desc_scraper if desc_scraper else desc_ia   
    
    desc_del_portal = job_data.get("company_description")
    if desc_del_portal:
        company_data["company_description"] = desc_del_portal
        company_data["original_offer_id"] =None

    reclutador = job_data.get("recruiter_name")
    if reclutador:
        partes = reclutador.strip().split(" ", 1)
        company_data["contact_first_name"] = partes[0]
        company_data["contact_last_name"] = partes[1] if len(partes) > 1 else None
    else:
        company_data["contact_first_name"] = None
        company_data["contact_last_name"] = None
    
    async with AsyncSessionLocal() as db_session:
        try:
            company_id = await upsert_company(db_session, company_data)
            if not company_id:
                raise Exception("No se pudo generar un ID para la empresa")
            
            await insert_job_offer(db_session, job_data,company_id)
            
            await db_session.commit()
            print(f"Guardado en la BD: ID Empresa {company_id}")
            return True
        
        except Exception as e:
            await db_session.rollback()
            print(f"Error en la BBDD: {traceback.format_exc()}")
            return False