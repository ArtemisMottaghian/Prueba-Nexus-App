import asyncio
import random
import urllib.parse
import re
import io
import aiohttp
from PyPDF2 import PdfReader
from app.db.session import AsyncSessionLocal
from .browser import get_browser_context
from .scraper_repository import upsert_scraped_candidate
from app.core.scraper_pdf_config import SECTORES_KEYWORDS, LOCATIONS, HEADLESS_MODE, MAX_PROFILES_PER_SEARCH
from typing import Optional, Dict, List, Any


# 1. EL "DETECTIVE" DE LINKEDIN POR YAHOO
async def search_external_profile(first_name: str, last_name: str) -> Optional[str]:
    """Busca silenciosamente en Yahoo si el candidato tiene LinkedIn."""
    if first_name == "Candidato": return None
    
    query = urllib.parse.quote_plus(f'"{first_name} {last_name}" site:linkedin.com/in/')
    url = f"https://es.search.yahoo.com/search?p={query}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    raw_html = await resp.text()
                    decoded_html = urllib.parse.unquote(raw_html)
                    match = re.search(r'https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9_-]+', decoded_html)
                    if match:
                        return match.group(0)
    except Exception:
        pass
    return None

# ==============================================================================
# 2. LECTURA Y EXTRACCIÓN DE PDF
# ==============================================================================
async def download_and_parse_pdf(pdf_url: str) -> str:
    # Descarga el PDF en memoria y extrae todo el texto ignorando errores SSL
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(pdf_url, timeout=15, ssl=False) as response:
                if response.status == 200:
                    pdf_bytes = await response.read()
                    pdf_file = io.BytesIO(pdf_bytes)
                    reader = PdfReader(pdf_file)
                    text = ""
                    for page in reader.pages[:3]:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    return text
    except Exception as e:
        print(f"   -> No se pudo leer el PDF {pdf_url}: {e}")
    return ""

def is_valid_cv(text:str) -> bool:
    # descartamos TFG, Boletines, ofertas de empleo
    text_lower = text.lower()
    # Palabras prohibidas
    bad_phrases = [
        'trabajo de fin de grado', 'trabajo fin de grado', 'tfg', 
        'trabajo de fin de máster', 'trabajo fin de máster', 'tfm',
        'boletín oficial', 'resolución de', 'bases de la convocatoria',
        'ayuntamiento de', 'oferta de empleo', 'pliego de prescripciones',
        'diario oficial', 'universidad de valladolid', 'facultad de',
        'proyecto fin de carrera'
    ]
    # Buscamos estas palabras en los primeros caracteres
    if any(phrase in text_lower[:1500] for phrase in bad_phrases):
        return False
    # debe tener secciones de CV
    cv_indicators = ['experiencia', 'formación', 'educación', 'idiomas', 'contacto']
    matches = sum(1 for ind in cv_indicators if ind in text_lower)
    # Si no tiene al menos dos secciones del CV lo descartamos
    if matches < 2:
        return False
    
    return True

def extract_data_from_text(text: str, pdf_url: str, keyword: str, location: str) -> Dict[str, Any]:
    
    # --- 1. Emails y Teléfonos ---
    email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    email = email_match.group(0) if email_match else f"cv_oculto_{random.randint(10000,99999)}@scraping.local"
    
    phone_match = re.search(r'(?:\+?34\s?)?[6789](?:[\s.-]?\d){8}', text)
    phone = phone_match.group(0) if phone_match else None

    # --- 2. URLs DENTRO del CV ---
    all_urls = re.findall(r'https?://[^\s<>"]+|www\.[^\s<>"]+', text)
    final_urls = None
    if all_urls:
        clean_urls = list(dict.fromkeys([url.rstrip(').,') for url in all_urls]))
        final_urls = " | ".join(clean_urls)[:255] if clean_urls else None

    # --- 3. EXTRACCIÓN DE NOMBRE ESTRICTA ---
    first_name = "Candidato"
    last_name = "PDF"
    
    name_prefix_match = re.search(r'(?i)(?:nombre y apellidos|nombre|candidato)[\s:]*([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)', text)
    if name_prefix_match:
        full_name_raw = name_prefix_match.group(1).strip()
        clean_full = re.sub(r'\s+', ' ', full_name_raw).strip()
        parts = clean_full.split(' ', 1)
        first_name = parts[0].capitalize()
        if len(parts) > 1:
            last_name = parts[1].title()
    else:
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        ignored_words = [
            'curriculum', 'vitae', 'cv', 'datos', 'personales', 'perfil', 'resumen', 
            'contacto', 'experiencia', 'educacion', 'tribunal', 'puesto', 'secretaría', 
            'lugar', 'telefónica', 'asistencia', 'valencia', 'departamento',
            'méritos', 'académicos', 'formación', 'estudios', 'titulación', 'profesional',
            'fecha', 'nacimiento', 'nacionalidad', 'dni', 'españa'
        ]
        for line in lines[:15]:
            line_lower = line.lower()
            if '@' in line or 'http' in line_lower or 'www' in line_lower or any(char.isdigit() for char in line):
                continue
            if len(line.split()) > 4 or len(line.split()) < 2:
                continue
            
            trash = any((ignore in line_lower and len(line.split()) <= 3) for ignore in ignored_words)
            if trash: continue

            clean_name = re.sub(r'[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]', '', line).strip()
            if clean_name and len(clean_name.split()) >= 2:
                parts = clean_name.split(' ', 1)
                first_name = parts[0].capitalize()
                last_name = parts[1].title()
                break

    # --- 4. LOCALIZACIÓN INTELIGENTE ---
    extracted_location = location
    if location.lower() == 'españa':
        provincias = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Salamanca', 'Granada', 'Oviedo', 'Badajoz', 'Toledo', 'Santander', 'Pamplona', 'Almería', 'Burgos', 'Cáceres', 'Cádiz', 'Castellón', 'Girona', 'Huelva', 'Huesca', 'Jaén', 'León', 'Lleida', 'Lugo', 'Ourense', 'Palencia', 'Pontevedra', 'Segovia', 'Soria', 'Tarragona', 'Teruel', 'Zamora']
        # Buscamos la ciudad en los primeros 1000 caracteres del CV
        for prov in provincias:
            if re.search(r'\b' + prov + r'\b', text[:1000], re.IGNORECASE):
                extracted_location = prov
                break

    # --- 5. EXPERIENCIA PURA (Sin límite) ---
    clean_exp = None
    # Busca "Experiencia" y coge TODO hasta que encuentre "Formación", "Educación", "Idiomas", "Otros" o el final del doc
    exp_match = re.search(r'(?i)(?:experiencia profesional|experiencia laboral|experiencia)[\s:]*(.*?)(?:\n\n[A-Z]|Formación|Educación|Idiomas|Otros datos|Aptitudes|Skills|Informática)', text, re.DOTALL)
    if exp_match:
        clean_exp = exp_match.group(1).strip()
        # Si extrae algo muy corto (menos de 20 chars), probablemente falló el regex, lo dejamos a None
        if len(clean_exp) < 20: 
            clean_exp = None

    # --- 6. SKILLS (MÉRITOS) ---
    skills_text = keyword
    merits_match = re.search(r'(?i)(?:méritos académicos|formación académica|formación|estudios|educación)[\s:]*(.*?)(?:\n\n|\Z|Experiencia|Cursos|Idiomas)', text, re.DOTALL)
    if merits_match:
        extracted_merits = merits_match.group(1).strip()
        skills_text = " | ".join([line.strip() for line in extracted_merits.split('\n') if line.strip()])[:600]

    return {
        "first_name": first_name,
        "last_name": last_name,
        "email": email.lower(),
        "phone": phone,
        "location": extracted_location, # Guardamos la ciudad real encontrada
        "source": "PDF scraper",
        "experience": clean_exp, # Experiencia aislada y sin límite de tamaño
        "linkedin_url": final_urls, 
        "cv_url": pdf_url, 
        "skills": skills_text, 
        "status": "active",
        "notes": None
    }

# 3. MOTOR PRINCIPAL
async def extract_pdf_profile(pdf_url:str, keyword: str, search_location: str) -> Optional[Dict[str, Any]]:
    print(f"-> Procesando PDF: {pdf_url}")
    text = await download_and_parse_pdf(pdf_url)

    if not text.strip():
        print(f"   -> El PDF estaba vacio o es una imagen escaneada")
        return None
    
    if not is_valid_cv(text):
        print(f"-> Descartado no parece un CV valido")
        return None
    
    candidate_data = extract_data_from_text(text, pdf_url, keyword, search_location)

    if "@scraping.local" not in candidate_data["email"]:
        print(f"   -> Email encontrado: {candidate_data['email']}")
    if candidate_data["phone"]:
        print(f"   -> Telefono encontrado: {candidate_data['phone']}")

    # --- Búsqueda en Yahoo de su LinkedIn si no lo puso en el CV ---
    if not candidate_data["candidate_url"]:
        print(f"   -> Buscando LinkedIn en la web para {candidate_data['first_name']} {candidate_data['last_name']}...")
        found_url = await search_external_profile(candidate_data['first_name'], candidate_data['last_name'])
        if found_url:
            candidate_data["candidate_url"] = found_url
            print(f"   -> ¡URL cazada!: {found_url}")

    # Busqueda del perfil de linkedin
    if not candidate_data["candidate_url"] and candidate_data["first_name"] != "Candidato":
        print(f"   -> Buscando LinkedIn en la web para {candidate_data['first_name']} {candidate_data['last_name']}")
        found_url = await search_external_profile(candidate_data['first_name'], candidate_data['last_name'])
        if found_url:
            candidate_data["candidate_url"] = found_url
            print(f"   -> ¡URL cazada!: {found_url}")

    return candidate_data

async def run_pdf_scraper(sectores_dict: dict, locations: list, headless: bool = False) -> None:
    print(f"Iniciando busqueda de CV en PDF (headless={headless})")
    pw, browser, context = await get_browser_context(headless=headless)
    if context is None:
        print("Error no se pudo cargar el navegador desde browser.py")
        return
    
    try:
        page = await context.new_page()

        if headless:
            await page.set_extra_http_headers({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            })
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        for sector_name, keywords in sectores_dict.items():
            print(f"\n--- Explorando {sector_name} ---")
            for loc in locations: 
                for kw in keywords:
                    query = f'filetype:pdf ("cv" OR "curriculum") "{kw}" "{loc}"'
                    print(f"Buscando: '{kw}' en '{loc}'")
                    
                    encoded_query = urllib.parse.quote_plus(query)
                    try:
                        await page.goto(f"https://es.search.yahoo.com/search?p={encoded_query}", wait_until="domcontentloaded", timeout=20000) 
                        await asyncio.sleep(random.uniform(3, 5))

                        try:
                            btn_cookies = page.locator('button[name="agree"], button.accept-all')
                            if await btn_cookies.count() > 0:
                                await btn_cookies.first.click()
                                await asyncio.sleep(1)
                        except Exception:
                            pass

                        raw_links = await page.locator('a').evaluate_all(
                            "elements => elements.map(e => e.href)"
                        )

                        pdf_links = []
                        for link in raw_links:
                            if link and '.pdf' in link.lower() and 'yahoo' not in link.lower():
                                pdf_links.append(link)

                        pdf_links = list(set(pdf_links))

                        if not pdf_links:
                            print(f"0 PDFs encontrados. Pasando a la siguiente kw")
                            continue

                        print(f"Encontrados {len(pdf_links)} posibles CV")

                        async with AsyncSessionLocal() as db:
                            for link in pdf_links[:MAX_PROFILES_PER_SEARCH]:
                                candidate_data = await extract_pdf_profile(link, kw, loc)

                                if candidate_data:
                                    success  = await upsert_scraped_candidate(db, candidate_data)
                                    if success:
                                        print(f"Guardado en BD: CV de {candidate_data['first_name']} {candidate_data['last_name']}")

                                await asyncio.sleep(random.uniform(2, 4))
                    except Exception as e:
                        print(f"-> Error navegando en Yahoo: {e}")

    except Exception as e:
        print(f"Error critico en scraper: {e}")
    finally:
        print("Cerrando navegador")
        try:
            if context: await context.close()
            if browser: await browser.close()
            if pw: await pw.stop()

            await asyncio.sleep(0.25)
        except:
            pass

if __name__ == "__main__":
    asyncio.run(run_pdf_scraper(
        sectores_dict=SECTORES_KEYWORDS,
        locations=LOCATIONS,
        headless=HEADLESS_MODE
    ))