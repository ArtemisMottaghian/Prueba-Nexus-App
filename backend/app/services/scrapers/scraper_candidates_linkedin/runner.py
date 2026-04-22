import asyncio
import random
import urllib.parse
from typing import Optional, Dict, List, Any, Tuple
from playwright.async_api import Page

# Importamos AsyncSession para el tipado de la base de datos
from sqlalchemy.ext.asyncio import AsyncSession 

from app.db.session import AsyncSessionLocal
from .browser import get_browser_context
from .utils import upsert_scraped_candidate
from app.core.scraper_candidates_linkedin_config import (
    SECTORS,
    LOCATIONS,
    HEADLESS_MODE,
    MAX_PROFILES_PER_SEARCH,
)


# FUNCIONES AUXILIARES DE EXTRACCIÓN (Subtareas)


async def apply_stealth_mode(page: Page) -> None:
    """
    Aplica configuraciones avanzadas mediante JavaScript para evadir la detección de bots.
    """
    await page.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    await page.add_init_script(
        "Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})"
    )
    await page.add_init_script(
        "window.chrome = { runtime: {} };"
    )
    await page.add_init_script(
        """
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        """
    )
    await page.add_init_script(
        "Object.defineProperty(navigator, 'languages', {get: () => ['es-ES', 'es', 'en-US', 'en']})"
    )

async def search_profiles_on_yahoo(page: Page, term: str, location: str) -> List[str]:
    """
    Realiza una búsqueda en Yahoo para extraer URLs de perfiles públicos.
    """
    query = f'site:es.linkedin.com/in/ {term} {location}'
    encoded_query = urllib.parse.quote_plus(query)
    unique_links = []

    try:
        await page.goto(
            f"https://es.search.yahoo.com/search?p={encoded_query}",
            wait_until="domcontentloaded",
            timeout=20000,
        )
        await asyncio.sleep(random.uniform(3, 5))

        try:
            btn_scroll = page.locator('button:has-text("Ir al final"), a:has-text("Ir al final")')
            if await btn_scroll.count() > 0:
                await btn_scroll.first.click(force=True, timeout=3000)
                await asyncio.sleep(1)

            btn_cookies = page.locator('button#didomi-notice-agree-button, button[name="agree"], button.accept-all, button:has-text("Aceptar todo"), button:has-text("Aceptar")')
            if await btn_cookies.count() > 0:
                await btn_cookies.first.click(force=True, timeout=3000)
                await asyncio.sleep(2)
        except Exception:
            pass

        raw_links = await page.locator("a").evaluate_all("elements => elements.map(e => e.href)")

        for link in raw_links:
            if link and "linkedin.com/in/" in link:
                clean_link = link
                if "RU=" in link:
                    try:
                        clean_link = urllib.parse.unquote(link.split("RU=")[1].split("/R")[0])
                    except Exception:
                        pass
                
                if "linkedin.com/in/" in clean_link and "yahoo.com" not in clean_link:
                    unique_links.append(clean_link)

    except Exception as e:
        print(f"-> Error en la busqueda de Yahoo: {e}")

    return list(set(unique_links))

async def extract_name_and_check_company(page: Page, url: str) -> Tuple[str, str, bool]:
    if "/company/" in url or "/school/" in url:
        return "", "", True

    page_title = await page.title()
    full_name = "Candidato LinkedIn"

    name_element = await page.query_selector("h1.text-heading-xlarge, h1.top-card-layout__title, h1")
    if name_element:
        full_name = await name_element.inner_text()

    if not name_element or not full_name.strip() or full_name == "Candidato LinkedIn":
        if page_title and "-" in page_title:
            full_name = page_title.split("-")[0]
        elif page_title and "|" in page_title:
            full_name = page_title.split("|")[0]

    full_name = full_name.strip()

    word_trap = [
        " s.l.", " s.a.", " inc", " ltd", " llc", "agencia", "servicios", 
        "tecnología", "solutions", "consulting", "diseño", "marketing", 
        "software", "estudio", "desarrollo", "master", "máster", 
        "universidad", "escuela", "instituto", "academia", "observatorio", 
        "fundación", "asociación", "ministerio", "ayuntamiento", 
        "colegio", "grupo", "group",
    ]

    if any(word in full_name.lower() for word in word_trap):
        return "", "", True

    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    return first_name, last_name, False

async def scroll_and_expand_profile(page: Page) -> None:
    print("   -> Deslizando para cargar el perfil...")
    viewport = page.viewport_size
    centro_x = viewport["width"] / 2 if viewport else 600
    centro_y = viewport["height"] / 2 if viewport else 400
    await page.mouse.move(centro_x, centro_y)

    for _ in range(8):
        await page.mouse.wheel(0, 600)
        await asyncio.sleep(random.uniform(1.0, 1.5))

    try:
        botones_ver_mas = await page.locator("button.inline-show-more-text__button").all()
        for btn in botones_ver_mas:
            if await btn.is_visible():
                await btn.click()
                await asyncio.sleep(0.5)
    except Exception:
        pass

async def extract_contact_email(page: Page, url: str) -> Optional[str]:
    real_email = None
    try:
        contact_link = await page.query_selector('a[href*="/overlay/contact-info/"], a#top-card-text-details-contact-info')
        if contact_link:
            await contact_link.click()
            await asyncio.sleep(2)

            email_el = await page.query_selector('section.ci-email a, div.ci-email a, a[href^="mailto:"]')
            if email_el:
                real_email = await email_el.inner_text()
                print(f"   -> Email encontrado: {real_email.strip()}")

            close_btn = await page.query_selector('button[aria-label="Cerrar"], button[aria-label="Dismiss"]')
            if close_btn:
                await close_btn.click()
            else:
                await page.mouse.click(10, 10)
            await asyncio.sleep(1)
    except Exception:
        pass

    return real_email.strip() if real_email else None

async def extract_experience_text(page: Page) -> Optional[str]:
    try:
        texto_crudo = await page.evaluate(
            """() => {
            const headers = Array.from(document.querySelectorAll('h2, h3, span, div.pvs-header__title'));
            const expH2 = headers.find(h => {
                const txt = h.innerText ? h.innerText.toLowerCase().trim() : '';
                return txt === 'experiencia' || txt === 'experience';
            });
            if (!expH2) return null;

            let card = expH2.closest('.artdeco-card') || expH2.closest('section');
            if (!card && expH2.parentElement && expH2.parentElement.parentElement) {
                card = expH2.parentElement.parentElement.parentElement;
            }
            if (!card) return null;

            const items = card.querySelectorAll('li.artdeco-list__item, div[componentkey*="entity-collection-item"]');
            if (items && items.length > 0) {
                return Array.from(items).map(item => item.innerText).join('|||');
            }
            return card.innerText;
        }"""
        )

        if not texto_crudo:
            return None

        if "|||" in texto_crudo:
            experiencias_limpias = []
            for bloque in texto_crudo.split("|||"):
                lineas = [
                    l.strip() for l in bloque.split("\n")
                    if l.strip() and l.strip().lower() not in ["mostrar más", "ver más", "...", "aptitudes:", "skills:", "ver todas"]
                ]
                if lineas:
                    experiencias_limpias.append(" • ".join(lineas))
            return "\n\n".join(experiencias_limpias)
        else:
            lineas = [
                l.strip() for l in texto_crudo.split("\n")
                if l.strip() and l.strip().lower() not in ["experiencia", "experience", "mostrar más", "ver más", "..."]
            ]
            return "\n".join(lineas) if lineas else None

    except Exception:
        return None

async def evaluate_availability(page: Page, full_experience: Optional[str]) -> bool:
    is_open_to_work = False
    is_currently_employed = False

    if full_experience:
        exp_lower = full_experience.lower()
        if "actualidad" in exp_lower or "present" in exp_lower:
            is_currently_employed = True

    try:
        textos_busqueda = [
            "open to work", "en busca de empleo", "buscando empleo", 
            "buscando trabajo", "búsqueda activa"
        ]
        is_open_to_work = await page.evaluate(
            f"""() => {{
            const terms = {textos_busqueda};
            const elements = Array.from(document.querySelectorAll('strong, p, h2, h3'));
            for (let el of elements) {{
                const text = el.innerText ? el.innerText.toLowerCase().trim() : '';
                if (terms.some(term => text.includes(term))) return true;
            }}
            return false;
        }}"""
        )

        if not is_open_to_work:
            todo_el_html = (await page.content()).lower()
            if '"open_to_work"' in todo_el_html or "#opentowork" in todo_el_html or "open-to-work-urn" in todo_el_html:
                is_open_to_work = True

    except Exception:
        pass

    if is_currently_employed and not is_open_to_work:
        print("   -> Descartado: Trabajando y sin indicador de buscar empleo.")
        return False

    return True

async def extract_skills_data(page: Page, url: str, fallback_keyword: str) -> str:
    skill_list = []
    try:
        skills_url = f"{url.rstrip('/')}/details/skills/"
        print(f"   -> Navegando a aptitudes: {skills_url}")

        await asyncio.sleep(random.uniform(3, 6))
        await page.goto(skills_url, wait_until="domcontentloaded", timeout=20000)
        
        await asyncio.sleep(random.uniform(2, 4))
        await page.mouse.wheel(0, 800)
        await asyncio.sleep(random.uniform(1.5, 3))
        await page.mouse.wheel(0, 800)
        await asyncio.sleep(random.uniform(2, 4))

        skill_containers = await page.query_selector_all('div[componentkey*="profile.skill"]')
        for container in skill_containers:
            title_el = await container.query_selector("p")
            if title_el:
                skill_text = await title_el.inner_text()
                if skill_text and skill_text.strip():
                    skill_list.append(skill_text.strip())

        skill_list = list(dict.fromkeys(skill_list))
        print(f"   -> Extraídas {len(skill_list)} aptitudes.")

    except Exception as e:
        print(f"   -> Advertencia al extraer aptitudes (se usara keyword por defecto): {e}")

    return ", ".join(skill_list) if skill_list else fallback_keyword


# ORQUESTADORES PRINCIPALES DE LINKEDIN


async def extract_profile_data(page: Page, url: str, keyword: str, search_location: str) -> Optional[Dict[str, Any]]:
    print(f"\nEntrando al perfil: {url}")
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(random.uniform(2, 4))

        first_name, last_name, is_company = await extract_name_and_check_company(page, url)
        if is_company:
            print(f"Saltando {url}. Parece ser una empresa.")
            return None

        await scroll_and_expand_profile(page)
        
        final_email = await extract_contact_email(page, url)

        loc_element = await page.query_selector("span.text-body-small.inline.t-black--light.break-words, h3.top-card-layout__first-subline")
        scraped_location = await loc_element.inner_text() if loc_element else search_location

        full_experience = await extract_experience_text(page)

        is_available = await evaluate_availability(page, full_experience)
        if not is_available:
            return None

        final_skills = await extract_skills_data(page, url, keyword)

        return {
            "first_name": first_name.strip() if first_name else "",
            "last_name": last_name.strip() if last_name else "",
            "email": final_email,
            "phone": None,
            "location": scraped_location,
            "source": "LinkedIn",
            "experience": full_experience,
            "candidate_url": url,
            "cv_url": None,
            "skills": final_skills,
            "status": "active",
            "notes": None,
        }
    except Exception as e:
        print(f"Error, no se ha podido parsear {url}: {e}")
        return None

# Añadimos el parametro 'db' (AsyncSession) a la funcion principal
async def extract_linked(sectors_dict: Dict[str, str], locations: List[str], db: AsyncSession, headless: bool = False) -> List[Dict[str, Any]]:
    print(f"Iniciando la búsqueda de candidatos (headless={headless})")

    all_extracted_candidates = []
    pw, browser, context = None, None, None

    try:
        pw, browser, context = await get_browser_context(headless=headless)
        if context is None:
            return all_extracted_candidates

        page = await context.new_page()
        
        await apply_stealth_mode(page)

        for loc in locations:
            for sector_name, term in sectors_dict.items():
                
                    print(f"\nBuscando en: '{sector_name}' en '{loc}'")

                    unique_links = await search_profiles_on_yahoo(page, term, loc)

                    if not unique_links:
                        print("0 resultados encontrados. Pasando a la siguiente búsqueda")
                        continue

                    print(f"Encontrados {len(unique_links)} posibles perfiles.")

                    for link in unique_links[:MAX_PROFILES_PER_SEARCH]:
                        await asyncio.sleep(random.uniform(5, 10))
                        
                        candidate_data = await extract_profile_data(page, link, sector_name, loc)

                        if candidate_data:
                            all_extracted_candidates.append(candidate_data)
                            print(f"  -> {candidate_data['first_name']} {candidate_data['last_name']} extraído correctamente.")
                            
                            # GUARDADO EN TIEMPO REAL: Justo al extraer el dato, lo mandamos a la base de datos
                            # Esto previene la perdida de informacion si el scraper se interrumpe
                            if db:
                                await upsert_scraped_candidate(db, candidate_data)

                        await asyncio.sleep(random.uniform(6, 12))

    except Exception as e:
        print(f"Error crítico en scraper principal: {e}")
    finally:
        print("Cerrando navegador...")
        try:
            if context: await context.close()
            if browser: await browser.close()
            if pw: await pw.stop()
        except:
            pass

    return all_extracted_candidates

if __name__ == "__main__":
    
    async def test_scraper():
        print("Iniciando test de scraping...")
        
        # Abrimos la sesion de BD de forma global para toda la operacion
        async with AsyncSessionLocal() as db:
            candidatos = await extract_linked(
                sectors_dict=SECTORS, 
                locations=LOCATIONS,
                db=db, 
                headless=HEADLESS_MODE,
            )
            

        print(f"\nFinalizado test. Se extrajeron y procesaron {len(candidatos)} candidatos en total.")

    asyncio.run(test_scraper())