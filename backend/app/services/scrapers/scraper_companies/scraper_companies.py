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

# Silenciamos el aviso de Google
warnings.filterwarnings("ignore", category=FutureWarning)
import google.generativeai as genai

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

from app.core.scraper_companies_config import DB_CONFIG
GEMINI_API_KEY = os.getenv("GOOGLE_AI_KEY")

os.environ["PGCLIENTENCODING"] = "utf-8"

if not GEMINI_API_KEY:
    print("❌ ERROR CRÍTICO: No se ha encontrado GOOGLE_AI_KEY en el .env.")
else:
    print("✅ API KEY de Gemini cargada correctamente.")
    genai.configure(api_key=GEMINI_API_KEY)


# ==========================================
# 1. SCRAPERS MERCANTILES (Empresite + eInforma)
# ==========================================
def buscar_datos_mercantiles_empresite(nombre_empresa: str) -> dict:
    print(f"   -> [1.5/3] Buscando CIF en Empresite para: {nombre_empresa}")
    datos_mercantiles = {"cif": None, "address": None, "phone": None}
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        query = urllib.parse.quote(nombre_empresa)
        url_busqueda = f"https://empresite.eleconomista.es/buscar/?q={query}"
        
        response_search = requests.get(url_busqueda, headers=headers, timeout=10)
        soup_search = BeautifulSoup(response_search.text, 'html.parser')
        
        primer_resultado = soup_search.select_first("h2 a")
        if not primer_resultado or not primer_resultado.has_attr("href"):
            print("   -> [AVISO] No se encontró enlace válido en Empresite.")
            return datos_mercantiles
            
        url_empresa = primer_resultado["href"]
        response_empresa = requests.get(url_empresa, headers=headers, timeout=10)
        soup_empresa = BeautifulSoup(response_empresa.text, 'html.parser')
        
        texto_pagina = soup_empresa.get_text()
        match_cif = re.search(r'[A-W]\d{8}', texto_pagina)
        if match_cif:
            datos_mercantiles["cif"] = match_cif.group()
            print(f"   -> [ÉXITO] CIF Encontrado en Empresite: {datos_mercantiles['cif']}")
            
        direccion_tag = soup_empresa.find("span", class_="locality")
        if direccion_tag:
            datos_mercantiles["address"] = direccion_tag.text.strip()
            
    except Exception as e:
        print(f"   -> [ERROR] Fallo al scrapear Empresite: {str(e)[:50]}")
        
    return datos_mercantiles


def buscar_datos_mercantiles_einforma_fallback(nombre_empresa: str) -> dict:
    print(f"   -> [PLAN B] Intentando rescatar CIF desde DuckDuckGo/eInforma...")
    datos_mercantiles = {"cif": None, "address": None, "phone": None}
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}
    
    try:
        query = urllib.parse.quote(f"site:einforma.com {nombre_empresa} CIF")
        url_busqueda = f"https://html.duckduckgo.com/html/?q={query}"
        
        response = requests.get(url_busqueda, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        match_cif = re.search(r'[A-W]\d{8}', soup.get_text())
        if match_cif:
            datos_mercantiles["cif"] = match_cif.group()
            print(f"   -> [ÉXITO PLAN B] CIF rescatado: {datos_mercantiles['cif']}")
            
    except Exception as e:
        print(f"   -> [ERROR PLAN B] Fallo al consultar: {str(e)[:50]}")
        
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

    # --- PASO 2: EMPRESITE / EINFORMA ---
    time.sleep(random.uniform(2.0, 4.0))
    datos_mercantiles = buscar_datos_mercantiles_empresite(nombre_limpio)
    
    # Si Empresite falla, activamos el Plan B
    if not datos_mercantiles.get("cif"):
        time.sleep(random.uniform(2.0, 3.0))
        datos_rescate = buscar_datos_mercantiles_einforma_fallback(nombre_limpio)
        if datos_rescate.get("cif"):
            datos_mercantiles["cif"] = datos_rescate.get("cif")
            
    cif_encontrado = datos_mercantiles.get("cif")
    dir_encontrada = datos_mercantiles.get("address")

    # --- PASO 3: GEMINI ---
    print(f"   -> [3/3] Pasando datos a Gemini para consolidar...")
    if not GEMINI_API_KEY:
         return {"name": nombre_limpio, "cif": cif_encontrado, "sector": None, "website": website_clearbit, "linkedin_url": None, "address": dir_encontrada, "contact_email": None, "contact_phone": None}

    model = genai.GenerativeModel('gemini-2.5-flash')
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
    - "cif": (usa el CIF dado o pon null)
    - "address": (usa la dirección dada o dedúcela)
    - "sector": (OBLIGATORIO deducirlo)
    - "linkedin_url": (OBLIGATORIO deducirlo)
    - "contact_email": (SOLO si aparece en el texto, si no null)
    - "contact_phone": (SOLO si aparece en el texto, si no null)
    """
    
    try:  
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        
        # 🛡️ ESCUDO ANTI-IA: Garantizamos que todas las claves existan para evitar KeyError
        claves_requeridas = ["name", "website", "cif", "address", "sector", "linkedin_url", "contact_email", "contact_phone"]
        for clave in claves_requeridas:
            if clave not in data:
                data[clave] = None
                
        print(f"   -> [OK] Datos consolidados por IA.")
        return data
        
    except Exception as e:
        print(f"   -> [ERROR] Fallo en Gemini: {str(e)[:50]}")
        return {
            "name": nombre_limpio, "cif": cif_encontrado, "sector": None, 
            "website": website_clearbit, "linkedin_url": None, "address": dir_encontrada, 
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
# 4. PUNTO DE ENTRADA (PROCESADOR PRINCIPAL)
# ==========================================
def process_scraped_job(job_data: dict) -> bool:
    job_title = job_data.get("title", "Título Desconocido")
    basic_company_name = job_data.get("company_name", "Empresa Confidencial")
    scraped_html_text = job_data.get("job_description", "")
    
    print(f"\n--- Procesando vacante: {job_title} ---")
    
    company_data = extract_company_data(scraped_html_text, basic_company_name)
    
    # Inyectar datos del reclutador para el diccionario final
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
        print(f" -> [ÉXITO] Guardado en BBDD (ID Empresa: {company_id})")
        return True

    except psycopg2.IntegrityError:
        print(f" -> [AVISO] La vacante ya existe (Duplicada).")
        if conn: conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f" -> [ERROR BBDD]: {e}")
        if conn: conn.rollback()
        return False
    finally:
        if conn:
            cursor.close()
            conn.close()