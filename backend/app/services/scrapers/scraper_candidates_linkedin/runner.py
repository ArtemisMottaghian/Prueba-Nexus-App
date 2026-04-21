import asyncio
import random
import urllib.parse
from typing import Optional, Dict, List, Any, Tuple
from playwright.async_api import Page

from .browser import get_browser_context
from .utils import upsert_scraped_candidate
from app.core.scraper_candidates_linkedin_config import (
    KEYWORDS,
    SECTORS,
    LOCATIONS,
    HEADLESS_MODE,
    MAX_PROFILES_PER_SEARCH,
)


# ==============================================================================
# FUNCIONES AUXILIARES DE EXTRACCIÓN (Subtareas)
# ==============================================================================


async def apply_stealth_mode(page: Page) -> None:
    """
    Aplica configuraciones al navegador para evitar la detección de bots (HeadlessChrome).

    Args:
        page (Page): Instancia de la página de Playwright actual.
    """
    await page.set_extra_http_headers(
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        }
    )
    await page.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    await page.add_init_script(
        "Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3]})"
    )


async def search_profiles_on_yahoo(
    page: Page, keyword: str, sector: str, location: str
) -> List[str]:
    """
    Realiza una búsqueda en Yahoo para sortear las protecciones de LinkedIn y extraer
    las URLs de los perfiles públicos. Gestiona los banners de cookies automáticamente.

    Args:
        page (Page): Instancia de la página.
        keyword (str): Palabra clave (ej. 'Python').
        sector (str): Sector industrial.
        location (str): Ubicación.

    Returns:
        List[str]: Lista de URLs limpias de perfiles de LinkedIn.
    """
    query = f'site:es.linkedin.com/in/ "{keyword}" "{sector}" "{location}"'
    encoded_query = urllib.parse.quote_plus(query)
    unique_links = []

    try:
        await page.goto(
            f"https://es.search.yahoo.com/search?p={encoded_query}",
            wait_until="domcontentloaded",
            timeout=20000,
        )
        await asyncio.sleep(3)

        # Cerrar banners de cookies
        try:
            btn_scroll = page.locator(
                'button:has-text("Ir al final"), a:has-text("Ir al final")'
            )
            if await btn_scroll.count() > 0:
                await btn_scroll.first.click(force=True, timeout=3000)
                await asyncio.sleep(1)

            btn_cookies = page.locator(
                'button#didomi-notice-agree-button, button[name="agree"], button.accept-all, button:has-text("Aceptar todo"), button:has-text("Aceptar")'
            )
            if await btn_cookies.count() > 0:
                await btn_cookies.first.click(force=True, timeout=3000)
                await asyncio.sleep(2)
        except Exception:
            pass

        # Extraer enlaces
        raw_links = await page.locator("a").evaluate_all(
            "elements => elements.map(e => e.href)"
        )

        for link in raw_links:
            if link and "linkedin.com/in/" in link:
                clean_link = link
                if "RU=" in link:
                    try:
                        clean_link = urllib.parse.quote(
                            link.split("RU=")[1].split("/R")[0]
                        )
                    except Exception:
                        pass
                if "linkedin.com/in/" in clean_link and "yahoo.com" not in clean_link:
                    unique_links.append(clean_link)

    except Exception as e:
        print(f"-> Error en la busqueda de Yahoo: {e}")

    return list(set(unique_links))


async def extract_name_and_check_company(page: Page, url: str) -> Tuple[str, str, bool]:
    """
    Extrae el nombre del perfil y determina si se trata de una empresa en lugar de una persona.

    Args:
        page (Page): Instancia de la página.
        url (str): URL actual del perfil.

    Returns:
        Tuple[str, str, bool]: (first_name, last_name, is_company).
    """
    if "/company/" in url or "/school/" in url:
        return "", "", True

    page_title = await page.title()
    full_name = "Candidato LinkedIn"

    name_element = await page.query_selector(
        "h1.text-heading-xlarge, h1.top-card-layout__title, h1"
    )
    if name_element:
        full_name = await name_element.inner_text()

    if not name_element or not full_name.strip() or full_name == "Candidato LinkedIn":
        if page_title and "-" in page_title:
            full_name = page_title.split("-")[0]
        elif page_title and "|" in page_title:
            full_name = page_title.split("|")[0]

    full_name = full_name.strip()

    word_trap = [
        " s.l.",
        " s.a.",
        " inc",
        " ltd",
        " llc",
        "agencia",
        "servicios",
        "tecnología",
        "solutions",
        "consulting",
        "diseño",
        "marketing",
        "software",
        "estudio",
        "desarrollo",
        "master",
        "máster",
        "universidad",
        "escuela",
        "instituto",
        "academia",
        "observatorio",
        "fundación",
        "asociación",
        "ministerio",
        "ayuntamiento",
        "colegio",
        "grupo",
        "group",
    ]

    if any(word in full_name.lower() for word in word_trap):
        return "", "", True

    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    return first_name, last_name, False


async def scroll_and_expand_profile(page: Page) -> None:
    """
    Realiza scroll hacia abajo para forzar la carga dinámica de elementos y
    despliega los botones de "Ver más" en la experiencia.

    Args:
        page (Page): Instancia de la página.
    """
    print("   -> Deslizando para cargar el perfil...")
    viewport = page.viewport_size
    centro_x = viewport["width"] / 2 if viewport else 600
    centro_y = viewport["height"] / 2 if viewport else 400
    await page.mouse.move(centro_x, centro_y)

    for _ in range(8):
        await page.mouse.wheel(0, 600)
        await asyncio.sleep(1.2)

    try:
        botones_ver_mas = await page.locator(
            "button.inline-show-more-text__button"
        ).all()
        for btn in botones_ver_mas:
            if await btn.is_visible():
                await btn.click()
                await asyncio.sleep(0.5)
    except Exception:
        pass


async def extract_contact_email(page: Page, url: str) -> str:
    """
    Abre la ventana modal de contacto e intenta extraer el correo electrónico visible.

    Args:
        page (Page): Instancia de la página.
        url (str): URL del perfil para generar un correo falso en caso de fallo.

    Returns:
        str: El email extraído o uno generado automáticamente.
    """
    try:
        perfil_id = url.split("/in/")[1].strip("/").split("?")[0]
    except:
        perfil_id = f"candidato_{random.randint(1000,9999)}"

    fake_email = f"{perfil_id}@scraping.local"
    real_email = None

    try:
        contact_link = await page.query_selector(
            'a[href*="/overlay/contact-info/"], a#top-card-text-details-contact-info'
        )
        if contact_link:
            await contact_link.click()
            await asyncio.sleep(2)

            email_el = await page.query_selector(
                'section.ci-email a, div.ci-email a, a[href^="mailto:"]'
            )
            if email_el:
                real_email = await email_el.inner_text()
                print(f"   -> Email encontrado: {real_email.strip()}")

            close_btn = await page.query_selector(
                'button[aria-label="Cerrar"], button[aria-label="Dismiss"]'
            )
            if close_btn:
                await close_btn.click()
            else:
                await page.mouse.click(10, 10)
            await asyncio.sleep(1)
    except Exception:
        pass

    return real_email.strip() if real_email else fake_email


async def extract_experience_text(page: Page) -> Optional[str]:
    """
    Extrae y limpia todo el texto de la sección de experiencia utilizando JavaScript.

    Args:
        page (Page): Instancia de la página.

    Returns:
        Optional[str]: Bloque de texto con la experiencia o None si no hay.
    """
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
                    l.strip()
                    for l in bloque.split("\n")
                    if l.strip()
                    and l.strip().lower()
                    not in [
                        "mostrar más",
                        "ver más",
                        "...",
                        "aptitudes:",
                        "skills:",
                        "ver todas",
                    ]
                ]
                if lineas:
                    experiencias_limpias.append(" • ".join(lineas))
            return "\n\n".join(experiencias_limpias)
        else:
            lineas = [
                l.strip()
                for l in texto_crudo.split("\n")
                if l.strip()
                and l.strip().lower()
                not in ["experiencia", "experience", "mostrar más", "ver más", "..."]
            ]
            return "\n".join(lineas) if lineas else None

    except Exception:
        return None


async def evaluate_availability(page: Page, full_experience: Optional[str]) -> bool:
    """
    Evalúa si el candidato es válido basándose en si está empleado y si tiene la marca OpenToWork.

    Args:
        page (Page): Instancia de la página.
        full_experience (Optional[str]): Texto de la experiencia para buscar la palabra 'actualidad'.

    Returns:
        bool: True si es candidato válido (busca empleo o está parado), False si está felizmente empleado.
    """
    is_open_to_work = False
    is_currently_employed = False

    if full_experience:
        exp_lower = full_experience.lower()
        if "actualidad" in exp_lower or "present" in exp_lower:
            is_currently_employed = True

    try:
        textos_busqueda = [
            "open to work",
            "en busca de empleo",
            "buscando empleo",
            "buscando trabajo",
            "búsqueda activa",
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
            if (
                '"open_to_work"' in todo_el_html
                or "#opentowork" in todo_el_html
                or "open-to-work-urn" in todo_el_html
            ):
                is_open_to_work = True

    except Exception:
        pass

    if is_currently_employed and not is_open_to_work:
        print("   -> Descartado: Trabajando y sin indicador de buscar empleo.")
        return False

    return True


async def extract_skills_data(page: Page, url: str, fallback_keyword: str) -> str:
    """
    Navega a la subpágina de aptitudes del perfil y extrae la lista de habilidades.

    Args:
        page (Page): Instancia de la página.
        url (str): URL base del perfil.
        fallback_keyword (str): Palabra clave a devolver si falla la extracción.

    Returns:
        str: String de aptitudes separadas por coma, o la keyword por defecto.
    """
    skill_list = []
    try:
        skills_url = f"{url.rstrip('/')}/details/skills/"
        print(f"   -> Navegando a aptitudes: {skills_url}")

        await page.goto(skills_url, wait_until="domcontentloaded", timeout=15000)
        await page.mouse.wheel(0, 800)
        await asyncio.sleep(1)
        await page.mouse.wheel(0, 800)
        await asyncio.sleep(1.5)

        skill_containers = await page.query_selector_all(
            'div[componentkey*="profile.skill"]'
        )
        for container in skill_containers:
            title_el = await container.query_selector("p")
            if title_el:
                skill_text = await title_el.inner_text()
                if skill_text and skill_text.strip():
                    skill_list.append(skill_text.strip())

        skill_list = list(dict.fromkeys(skill_list))
        print(f"   -> Extraídas {len(skill_list)} aptitudes.")

    except Exception:
        pass

    return ", ".join(skill_list) if skill_list else fallback_keyword


# ==============================================================================
# ORQUESTADORES PRINCIPALES DE LINKEDIN
# ==============================================================================


async def extract_profile_data(
    page: Page, url: str, keyword: str, search_location: str
) -> Optional[Dict[str, Any]]:
    """
    Coordina la extracción completa de un perfil individual llamando a las funciones auxiliares.

    Args:
        page (Page): Instancia de la página.
        url (str): La URL del perfil a raspar.
        keyword (str): La palabra clave original de búsqueda.
        search_location (str): Ubicación original de búsqueda.

    Returns:
        Optional[Dict[str, Any]]: Diccionario del candidato o None si es descartado.
    """
    print(f"\nEntrando al perfil: {url}")
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(2)

        # 1. Nombre y Empresa
        first_name, last_name, is_company = await extract_name_and_check_company(
            page, url
        )
        if is_company:
            print(f"Saltando {url} Parece ser una empresa.")
            return None

        # 2. Scroll para cargar DOM
        await scroll_and_expand_profile(page)

        # 3. Email
        final_email = await extract_contact_email(page, url)

        # 4. Ubicación
        loc_element = await page.query_selector(
            "span.text-body-small.inline.t-black--light.break-words, h3.top-card-layout__first-subline"
        )
        scraped_location = (
            await loc_element.inner_text() if loc_element else search_location
        )

        # 5. Experiencia
        full_experience = await extract_experience_text(page)

        # 6. Disponibilidad (Si trabaja y no busca, descartamos)
        is_available = await evaluate_availability(page, full_experience)
        if not is_available:
            return None

        # 7. Skills (Hace cambio de página, debe ser lo último)
        final_skills = await extract_skills_data(page, url, keyword)

        return {
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
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


async def extract_linked(
    keywords: List[str],
    sectors: List[str],
    locations: List[str],
    headless: bool = False,
) -> List[Dict[str, Any]]:
    """
    Punto de entrada principal. Configura el navegador y coordina la búsqueda
    de perfiles en base a listas de parámetros.

    Args:
        keywords (List[str]): Lista de roles.
        sectors (List[str]): Lista de sectores.
        locations (List[str]): Lista de ciudades.
        headless (bool): Modo oculto del navegador.

    Returns:
        List[Dict[str, Any]]: Lista plana de todos los candidatos extraídos.
    """
    print(f"Iniciando la busqueda de candidatos (headless={headless})")

    all_extracted_candidates = []
    pw, browser, context = None, None, None

    try:
        pw, browser, context = await get_browser_context(headless=headless)
        if context is None:
            return all_extracted_candidates

        page = await context.new_page()

        if headless:
            await apply_stealth_mode(page)

        for loc in locations:
            for sector in sectors:
                for kw in keywords:
                    print(f"\nBuscando: '{kw}' en '{sector}' en '{loc}'")

                    unique_links = await search_profiles_on_yahoo(page, kw, sector, loc)

                    if not unique_links:
                        print(
                            f"0 resultados encontrados. Pasando a la siguiente búsqueda"
                        )
                        continue

                    print(f"Encontrados {len(unique_links)} posibles perfiles.")

                    for link in unique_links[:MAX_PROFILES_PER_SEARCH]:
                        candidate_data = await extract_profile_data(page, link, kw, loc)

                        if candidate_data:
                            all_extracted_candidates.append(candidate_data)
                            print(
                                f"  -> {candidate_data['first_name']} {candidate_data['last_name']} añadido a la lista."
                            )

                        await asyncio.sleep(random.uniform(4, 7))

    except Exception as e:
        print(f"Error critico en scraper principal: {e}")
    finally:
        print("Cerrando navegador...")
        try:
            if context:
                await context.close()
            if browser:
                await browser.close()
            if pw:
                await pw.stop()
        except:
            pass

    return all_extracted_candidates


if __name__ == "__main__":

    async def test_scraper():
        candidatos = await run_scraper(
            keywords=KEYWORDS,
            sectors=SECTORS,
            locations=LOCATIONS,
            headless=HEADLESS_MODE,
        )
        print(
            f"\nFinalizado test. Se extrajeron {len(candidatos)} candidatos en total."
        )

    asyncio.run(test_scraper())
