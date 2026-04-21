import psycopg2
import json
import os
import requests
import warnings
import time
import random
import urllib.parse
import re
from bs4 import BeautifulSoup

# 1. Silenciamos a Google
warnings.filterwarnings("ignore", category=FutureWarning)
import google.generativeai as genai

# 2. Silenciamos DEFINITIVAMENTE el aviso de InsecureRequestWarning de requests
requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

from app.core.scraper_companies_config import DB_CONFIG
GEMINI_API_KEY = os.getenv("GOOGLE_AI_KEY")

os.environ["PGCLIENTENCODING"] = "utf-8"

if not GEMINI_API_KEY:
    print("[ERROR CRÍTICO] No se ha encontrado GOOGLE_AI_KEY en el .env.")
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

    # --- PASO 3: GEMINI ---
    print(f"   -> [3/3] Pasando datos a Gemini para consolidar...")
    if not GEMINI_API_KEY:
         return {"name": nombre_limpio, "cif": cif_encontrado, "sector": None, "website": website_clearbit, "linkedin_url": None, "address": "Provincia/Pais no especificado", "contact_email": None, "contact_phone": None}

    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # PROMPT ENDURECIDO PARA LA DIRECCION
    prompt = f"""
    Actúa como investigador B2B. Oferta de la empresa "{nombre_limpio}".
    Datos previos encontrados:
    - Web: {website_clearbit if website_clearbit else 'Desconocida'}
    - CIF: {cif_encontrado if cif_encontrado else 'Desconocido'}
    - Dirección Legal: {dir_encontrada if dir_encontrada else 'Desconocida'}
    
    Texto: {raw_text}

    Devuelve ÚNICAMENTE un JSON con estas claves exactas:
    - "name": "{nombre_limpio}"
    - "website": (usa la web dada o dedúcela)
    - "cif": (Si te he dado un CIF, úsalo. Si es 'Desconocido', usa tu base de conocimiento OBLIGATORIAMENTE para deducir el CIF/NIF real en España de esta empresa. Ej: Banco Santander, Carrefour, Mutua Madrileña, etc. Si es una empresa extranjera sin sede fiscal en España, pon null).
    - "address": (Usa la dirección dada. Si no la tienes, deduce OBLIGATORIAMENTE la Provincia y el País. NUNCA devuelvas null en address)
    - "sector": (OBLIGATORIO deducirlo)
    - "linkedin_url": (OBLIGATORIO deducirlo)
    - "contact_email": (SOLO si aparece en el texto, si no null)
    - "contact_phone": (SOLO si aparece en el texto, si no null)
    """
    
    try:  
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        
        # ESCUDO VALIDADOR MODIFICADO PARA LA DIRECCION
        claves_requeridas = ["name", "website", "cif", "address", "sector", "linkedin_url", "contact_email", "contact_phone"]
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
def upsert_company(cursor, company_data: dict) -> int:
    query = """
        INSERT INTO companies (
            name, cif, sector, website, linkedin_url, address, 
            contact_first_name, contact_last_name, contact_email, contact_phone, updated_at
        ) VALUES (
            %(name)s, %(cif)s, %(sector)s, %(website)s, %(linkedin_url)s, %(address)s,
            %(contact_first_name)s, %(contact_last_name)s, %(contact_email)s, %(contact_phone)s, CURRENT_TIMESTAMP
        )
        ON CONFLICT (name) 
        DO UPDATE SET 
            cif = COALESCE(EXCLUDED.cif, companies.cif),
            sector = COALESCE(EXCLUDED.sector, companies.sector),
            website = COALESCE(EXCLUDED.website, companies.website),
            linkedin_url = COALESCE(EXCLUDED.linkedin_url, companies.linkedin_url),
            address = COALESCE(EXCLUDED.address, companies.address),
            contact_first_name = COALESCE(EXCLUDED.contact_first_name, companies.contact_first_name),
            contact_last_name = COALESCE(EXCLUDED.contact_last_name, companies.contact_last_name),
            contact_email = COALESCE(EXCLUDED.contact_email, companies.contact_email),
            contact_phone = COALESCE(EXCLUDED.contact_phone, companies.contact_phone),
            updated_at = CURRENT_TIMESTAMP
        RETURNING id;
    """
    cursor.execute(query, company_data)
    return cursor.fetchone()[0] 

def insert_job_offer(cursor, job_data: dict, company_id: int):
    query = """
        INSERT INTO job_offers (
            portal_id, company_id, company_name, external_id, title, location, offer_url, 
            job_description, company_description, published_at, sector, salary_min, salary_max, 
            contract_type, contract_time, work_modality, recruiter_name
        ) VALUES (
            %(portal_id)s, %(company_id)s, %(company_name)s, %(external_id)s, %(title)s, %(location)s, %(offer_url)s, 
            %(job_description)s, %(company_description)s, %(published_at)s, %(sector)s, %(salary_min)s, %(salary_max)s, 
            %(contract_type)s, %(contract_time)s, %(work_modality)s, %(recruiter_name)s
        )
    """
    job_data['company_id'] = company_id
    if 'company_description' not in job_data: job_data['company_description'] = None
    if 'company_name' not in job_data: job_data['company_name'] = None
    if 'recruiter_name' not in job_data: job_data['recruiter_name'] = None
    cursor.execute(query, job_data)


# ==========================================
# 4. PUNTO DE ENTRADA 
# ==========================================
def process_scraped_job(job_data: dict) -> bool:
    job_title = job_data.get("title", "Titulo Desconocido")
    basic_company_name = job_data.get("company_name", "Empresa Confidencial")
    scraped_html_text = job_data.get("job_description", "")
    
    print(f"\n--- Procesando vacante: {job_title} ---")
    
    company_data = extract_company_data(scraped_html_text, basic_company_name)
    
    reclutador = job_data.get("recruiter_name")
    if reclutador:
        partes = reclutador.strip().split(" ", 1)
        company_data["contact_first_name"] = partes[0]
        company_data["contact_last_name"] = partes[1] if len(partes) > 1 else None
    else:
        company_data["contact_first_name"] = None
        company_data["contact_last_name"] = None
    
    if not company_data or not company_data.get("name"):
        print(" -> Descartando oferta: No se pudo establecer nombre de empresa.")
        return False

    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        company_id = upsert_company(cursor, company_data)
        
        job_data['company_name'] = company_data['name']
        insert_job_offer(cursor, job_data, company_id)

        conn.commit()
        print(f" -> Guardado en BBDD (ID Empresa: {company_id})")
        return True

    except psycopg2.IntegrityError:
        print(f" -> La vacante ya existe (Duplicada).")
        if conn: conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f" -> ERROR BBDD: {e}")
        if conn: conn.rollback()
        return False
    finally:
        if conn:
            cursor.close()
            conn.close()