import asyncio
import random
import urllib.parse
import re
import io
import os
import json
import aiohttp
from pathlib import Path
from PyPDF2 import PdfReader
from dotenv import load_dotenv

# Carga el .env con ruta absoluta para que funcione tanto en local como en Cloud
_ENV_PATH = Path(__file__).resolve().parents[4] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

from app.db.session import AsyncSessionLocal
from .browser import get_browser_context
from .scraper_repository import upsert_scraped_candidate
from app.core.scraper_pdf_config import SECTORES_KEYWORDS, LOCATIONS, HEADLESS_MODE, MAX_PROFILES_PER_SEARCH


# ==============================================================================
# 1. EXTRACCIÓN DE NOMBRE CON CLAUDE API
# ==============================================================================
async def extract_name_with_claude(text: str) -> tuple[str, str]:
    """
    Usa Claude Haiku para extraer el nombre del candidato de las primeras
    líneas del CV. Devuelve (first_name, last_name) o ("Candidato", "PDF").
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("     AVISO: ANTHROPIC_API_KEY no encontrada en .env — nombre no extraíble.")
        return "Candidato", "PDF"

    snippet = text[:800].strip()
    if not snippet:
        return "Candidato", "PDF"

    prompt = f"""Eres un extractor de datos de CVs en español. Tu única tarea es encontrar el nombre completo de la persona que escribió este CV.

REGLAS:
- Devuelve SOLO un JSON con "first_name" y "last_name"
- "first_name": nombre de pila (ej: "María", "Juan Carlos")
- "last_name": apellidos (ej: "García López")
- NO incluyas títulos (Dr., Dña.), cargos (Director, Consultor, Secretario) ni empresas
- Si no encuentras un nombre real de persona, devuelve {{"first_name": "Candidato", "last_name": "PDF"}}
- Responde ÚNICAMENTE con el JSON, sin markdown ni explicaciones

TEXTO:
{snippet}"""

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 80,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=12
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    raw = data["content"][0]["text"].strip()
                    raw = re.sub(r"```json|```", "", raw).strip()
                    parsed = json.loads(raw)
                    first = parsed.get("first_name", "").strip()
                    last  = parsed.get("last_name", "").strip()
                    if first and last and first != "Candidato" and not first[0].isdigit():
                        return first, last
                else:
                    body = await resp.json()
                    print(f"     Claude API error {resp.status}: {body.get('error', {}).get('message','')}")
    except json.JSONDecodeError as e:
        print(f"     Claude devolvió JSON inválido: {e}")
    except Exception as e:
        print(f"     Excepción Claude API: {type(e).__name__}: {e}")

    return "Candidato", "PDF"


# ==============================================================================
# 2. BÚSQUEDA DE LINKEDIN — Google Custom Search API
# ==============================================================================
async def search_linkedin_profile(first_name: str, last_name: str) -> str | None:
    """
    Busca el perfil de LinkedIn usando Google Custom Search API.
    Requiere GOOGLE_API_KEY y GOOGLE_CSE_ID en el .env.
    Gratuito hasta 100 búsquedas/día.
    """
    if not first_name or first_name == "Candidato":
        return None

    api_key = os.environ.get("GOOGLE_API_KEY", "")
    cse_id  = os.environ.get("GOOGLE_CSE_ID", "")

    if not api_key or not cse_id:
        print("     AVISO: GOOGLE_API_KEY o GOOGLE_CSE_ID no definidas — búsqueda LinkedIn desactivada.")
        return None

    linkedin_pattern = re.compile(r'https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9_\-]+')

    # Intentamos con nombre completo y luego solo primer apellido
    primer_apellido = last_name.split()[0] if len(last_name.split()) > 1 else last_name
    queries = list(dict.fromkeys([  # elimina duplicados preservando orden
        f'"{first_name} {last_name}" site:linkedin.com/in',
        f'"{first_name} {primer_apellido}" site:linkedin.com/in',
    ]))

    for query in queries:
        try:
            params = {
                "key": api_key,
                "cx":  cse_id,
                "q":   query,
                "num": 3,
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params=params,
                    timeout=10
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for item in data.get("items", []):
                            url = item.get("link", "")
                            if linkedin_pattern.search(url):
                                return url
                            # A veces la URL real viene en displayLink + snippet
                            snippet = item.get("snippet", "")
                            match = linkedin_pattern.search(snippet)
                            if match:
                                return match.group(0)
                    elif resp.status == 429:
                        print("     Google CSE: límite diario de 100 búsquedas alcanzado.")
                        return None
                    else:
                        body = await resp.json()
                        print(f"     Google CSE error {resp.status}: {body.get('error', {}).get('message','')}")
        except Exception as e:
            print(f"     Excepción búsqueda LinkedIn: {type(e).__name__}: {e}")

        await asyncio.sleep(0.5)  # pausa cortés entre queries

    return None


# ==============================================================================
# 3. DESCARGA Y LECTURA DE PDF
# ==============================================================================
async def download_and_parse_pdf(pdf_url: str) -> str:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(pdf_url, timeout=15, ssl=False) as response:
                if response.status == 200:
                    reader = PdfReader(io.BytesIO(await response.read()))
                    text = "".join(
                        page.extract_text() + "\n"
                        for page in reader.pages[:4]
                        if page.extract_text()
                    )
                    return text
    except Exception:
        pass
    return ""


# ==============================================================================
# 4. VALIDACIÓN: ¿ES REALMENTE UN CV?
# ==============================================================================
def is_valid_cv(text: str, pdf_url: str) -> bool:
    text_lower = text.lower()
    url_lower  = pdf_url.lower()

    if any(x in url_lower for x in ["dialnet", "redalyc", "boe.es", "bocm", "bases", "calificador", "convocatoria", "oferta"]):
        return False

    bad_phrases = [
        "tribunal calificador", "bolsa de empleo", "proceso selectivo", "concurso-oposición",
        "trabajo de fin de grado", "tfg", "tfm", "boletín oficial", "pliego de prescripciones",
        "diario oficial", "distancia uned"
    ]
    if any(p in text_lower[:2000] for p in bad_phrases):
        return False

    foreign_indicators = [
        "+52", "+54", "+56", "+57", "+51", "+59",
        "méxico", "argentina", "colombia", "chile", "perú", "ecuador",
        "venezuela", "república dominicana", "jalisco", "bogotá", "lima",
        "buenos aires", "santiago de chile", "monterrey"
    ]
    if any(i in text_lower[:1500] for i in foreign_indicators):
        return False

    if text_lower.count("currículum") + text_lower.count("curriculum") > 4:
        return False

    cv_indicators = ["experiencia", "formación", "educación", "idiomas", "contacto", "méritos", "docencia"]
    if sum(1 for i in cv_indicators if i in text_lower) < 2:
        return False

    return True


# ==============================================================================
# 5. EXTRACCIÓN DE CONTACTO Y SKILLS (regex, sin coste de API)
# ==============================================================================
def extract_contact_and_skills(text: str, pdf_url: str, keyword: str, location: str) -> dict:
    # Teléfono
    phone_match = re.search(r"(?:\+?34\s?)?[6789](?:[\s.\-]?\d){8}", text)
    phone = phone_match.group(0).strip() if phone_match else None

    # Email
    email_match = re.search(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,7}\b", text)
    email = email_match.group(0).lower() if email_match else None

    # URL de perfil dentro del propio PDF
    linkedin_in_pdf = re.findall(r"(?i)https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9_\-]+/?", text)
    infojobs_in_pdf = re.findall(r"(?i)https?://(?:www\.)?infojobs\.net/[A-Za-z0-9_/\-]+", text)
    candidate_url = (linkedin_in_pdf + infojobs_in_pdf)[0] if (linkedin_in_pdf or infojobs_in_pdf) else None

    # Localización
    extracted_location = location
    if location.lower() == "españa":
        provincias = [
            "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia",
            "Palma", "Las Palmas", "Bilbao", "Alicante", "Córdoba", "Valladolid", "Vigo",
            "Gijón", "Salamanca", "Granada", "Oviedo", "Badajoz", "Toledo", "Santander",
            "Pamplona", "Almería", "Burgos", "Cáceres", "Cádiz", "Castellón", "Girona",
            "Huelva", "Huesca", "Jaén", "León", "Lleida", "Lugo", "Ourense", "Palencia",
            "Pontevedra", "Segovia", "Soria", "Tarragona", "Teruel", "Zamora"
        ]
        for prov in provincias:
            if re.search(r"\b" + prov + r"\b", text[:1500], re.IGNORECASE):
                extracted_location = prov
                break

    # Experiencia profesional
    clean_exp = None
    exp_match = re.search(
        r"(?i)(?:experiencia profesional|experiencia laboral|experiencia|historial profesional|trayectoria|docencia)"
        r"[\s:]*(.*?)(?=\n\s*(?:Formación|Educación|Idiomas|Otros datos|Aptitudes|Skills|Informática|Méritos|Titulación|Publicaciones)|\Z)",
        text, re.DOTALL
    )
    if exp_match:
        clean_exp = exp_match.group(1).strip()
    if not clean_exp or len(clean_exp) < 20:
        date_match = re.search(
            r"(?i)((?:19|20)\d{2}\s*[-a]\s*(?:(?:19|20)\d{2}|actualidad|presente|hoy).*?)"
            r"(?=\n\s*(?:Formación|Educación|Idiomas|Otros)|\Z)",
            text, re.DOTALL
        )
        if date_match:
            clean_exp = date_match.group(1).strip()
    if clean_exp and len(clean_exp) < 20:
        clean_exp = None

    # Skills
    skills_text = keyword
    skills_match = re.search(
        r"(?i)(?:méritos académicos|formación académica|formación|estudios|educación|aptitudes|skills|competencias)"
        r"[\s:]*(.*?)(?=\n\s*(?:Experiencia|Cursos|Idiomas|Otros|Publicaciones|Docencia)|\Z)",
        text, re.DOTALL
    )
    if skills_match:
        raw_skills = skills_match.group(1).strip()
        skills_text = " | ".join(l.strip() for l in raw_skills.split("\n") if l.strip())[:600]

    return {
        "phone":         phone,
        "email":         email,
        "candidate_url": candidate_url,
        "location":      extracted_location,
        "experience":    clean_exp,
        "skills":        skills_text,
    }


# ==============================================================================
# 6. PIPELINE COMPLETO PARA UN PDF
# ==============================================================================
async def extract_pdf_profile(pdf_url: str, keyword: str, search_location: str) -> dict | None:
    print(f"  -> Procesando: {pdf_url}")

    text = await download_and_parse_pdf(pdf_url)
    if not text.strip():
        print("     Descartado: PDF vacío o escaneado.")
        return None
    if not is_valid_cv(text, pdf_url):
        print("     Descartado: No parece un CV válido.")
        return None

    contact_data = extract_contact_and_skills(text, pdf_url, keyword, search_location)

    print("     Extrayendo nombre con Claude...")
    first_name, last_name = await extract_name_with_claude(text)
    print(f"     Nombre: {first_name} {last_name}")

    # Email ficticio si no hay uno real
    email = contact_data["email"]
    if not email:
        if first_name != "Candidato":
            def norm(s):
                return re.sub(r"[^a-z0-9]", "", s.lower()
                    .replace("á","a").replace("é","e").replace("í","i")
                    .replace("ó","o").replace("ú","u").replace("ñ","n").replace(" ",""))
            email = f"{norm(first_name)}.{norm(last_name)}@scraping.local"
        else:
            email = f"cv_oculto_{random.randint(10000,99999)}@scraping.local"

    if "@scraping.local" not in email:
        print(f"     Email: {email}")
    if contact_data["phone"]:
        print(f"     Teléfono: {contact_data['phone']}")

    # Buscar LinkedIn solo si no había URL en el PDF
    candidate_url = contact_data["candidate_url"]
    if not candidate_url and first_name != "Candidato":
        print(f"     Buscando LinkedIn: {first_name} {last_name}...")
        candidate_url = await search_linkedin_profile(first_name, last_name)
        if candidate_url:
            print(f"     URL encontrada: {candidate_url}")

    return {
        "first_name":    first_name,
        "last_name":     last_name,
        "email":         email,
        "phone":         contact_data["phone"],
        "location":      contact_data["location"],
        "source":        "PDF scraper",
        "experience":    contact_data["experience"],
        "candidate_url": candidate_url,
        "cv_url":        pdf_url,
        "skills":        contact_data["skills"],
        "status":        "active",
        "notes":         None,
    }


# ==============================================================================
# 7. MOTOR PRINCIPAL
# ==============================================================================
async def run_pdf_scraper(sectores_dict: dict, locations: list, headless: bool = True):
    print(f"Iniciando scraper de CV en PDF (headless={headless})")
    pw, browser, context = await get_browser_context(headless=headless)
    if context is None:
        print("Error crítico: no se pudo inicializar el navegador.")
        return

    try:
        page = await context.new_page()
        if headless:
            await page.set_extra_http_headers({
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
            })
            await page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )

        for sector_name, keywords in sectores_dict.items():
            print(f"\n{'='*60}\nSector: {sector_name}\n{'='*60}")
            for loc in locations:
                for kw in keywords:
                    query = f'filetype:pdf ("cv" OR "curriculum") "{kw}" "{loc}"'
                    print(f"\nBuscando: '{kw}' en '{loc}'")
                    encoded_query = urllib.parse.quote_plus(query)
                    try:
                        await page.goto(
                            f"https://es.search.yahoo.com/search?p={encoded_query}",
                            wait_until="domcontentloaded", timeout=20000
                        )
                        await asyncio.sleep(random.uniform(3, 5))
                        try:
                            btn = page.locator("button[name='agree'], button.accept-all")
                            if await btn.count() > 0:
                                await btn.first.click()
                                await asyncio.sleep(1)
                        except Exception:
                            pass

                        raw_links = await page.locator("a").evaluate_all(
                            "elements => elements.map(e => e.href)"
                        )
                        pdf_links = list({
                            l for l in raw_links
                            if l and ".pdf" in l.lower() and "yahoo" not in l.lower()
                        })

                        if not pdf_links:
                            print("  0 PDFs encontrados.")
                            continue
                        print(f"  {len(pdf_links)} posibles CVs encontrados.")

                        async with AsyncSessionLocal() as db:
                            for link in pdf_links[:MAX_PROFILES_PER_SEARCH]:
                                candidate_data = await extract_pdf_profile(link, kw, loc)
                                if candidate_data:
                                    success = await upsert_scraped_candidate(db, candidate_data)
                                    if success:
                                        print(f"  ✓ Guardado: {candidate_data['first_name']} {candidate_data['last_name']}")
                                await asyncio.sleep(random.uniform(2, 4))
                    except Exception as e:
                        print(f"  Error en '{kw}' / '{loc}': {e}")

    except Exception as e:
        print(f"Error crítico: {e}")
    finally:
        print("\nCerrando navegador...")
        try:
            if context: await context.close()
            if browser: await browser.close()
            if pw: await pw.stop()
            await asyncio.sleep(0.25)
        except Exception:
            pass
        print("Scraper finalizado.")


if __name__ == "__main__":
    asyncio.run(run_pdf_scraper(
        sectores_dict=SECTORES_KEYWORDS,
        locations=LOCATIONS,
        headless=HEADLESS_MODE
    ))