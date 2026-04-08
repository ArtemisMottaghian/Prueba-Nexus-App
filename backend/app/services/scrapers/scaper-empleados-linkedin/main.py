import asyncio
import random
import urllib.parse
# Ajuste de rutas para la estructura de carpetas
from app.db.session import AsyncSessionLocal
from .browser import get_browser_context
from .scraper_repository import upsert_scraped_candidate
from app.core.scraper_linkedin_candidatos_config import KEYWORDS, SECTORS, LOCATIONS, HEADLESS_MODE, MAX_PROFILES_PER_SEARCH

async def extract_profile_data(page, url, keyword, search_location):
    # Si topamos con una empresa la salta
    if '/company/' in url or '/school/' in url:
        return None

    # Entra al perfil y obtiene la información visible publicamente
    print (f"Entrando al perfil: {url}")
    try:
        # Cogemos el perfil y que cargue el DOM
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)

        # Scroll para cargar secciones ocultas
        await page.mouse.wheel(0,800)
        await asyncio.sleep(1.5)
        await page.mouse.wheel(0.800)
        await asyncio.sleep(2)

        # Depuración visual para ver en consola que pagina esta viendo el bot
        page_title = await page.title()

        # Definimos un valor por defecto seguro
        full_name = "Candidato LinkedIn"

        # Extracción del Nombre
        name_element = await page.query_selector('h1.text-heading-xlarge, h1.top-card-layout__title, h1')
        # Si lo encuentra actualiza el nombre
        if name_element:
            full_name = await name_element.inner_text()

        if not name_element or not full_name.strip() or full_name == "Candidato LinkedIn":
            # Aquí lee el nombre del titulo de la pestaña
            if page_title and '-' in page_title:
                full_name = page_title.split('-')[0]
            elif page_title and '|' in page_title:
                full_name = page_title.split('|')[0]

        full_name = full_name.strip()

        # Filtrar que las empresas no entren por el nombre
        name_lower = full_name.lower()
        if any(word in name_lower for word in [' s.l.', ' s.a.', ' s.l', ' s.a', ' inc', ' sl', ' sa']):
            print(f"Saltando {url} Parece ser una empresa: {full_name}")

        # Limpiamos el nombre
        name_parts = full_name.strip().split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Extraer Ubicación
        loc_element = await page.query_selector('span.text-body-small.inline.t-black--light.break-words, h3.top-card-layout__first-subline')
        scraped_location = await loc_element.inner_text() if loc_element else "No especificada"

        # Extraer experiencia
        exp = "No visible"
        try:
            # Buscamos el título del puesto EJ: backend Developer
            title_el = await page.query_selector('h3.profile-section-card__title, span.experience-item__subtitle,, li.experience-item h3')
            # Buscamos el subtitulo EJ: nombre de la empresa - 3 años
            subtitle_el = await page.query_selector('h4.profile-section-card__subtitle, span.experience-item__subtitle, li.experience-item h4')

            puesto = await title_el.inner_text() if title_el else ""
            company_time = await subtitle_el.inner_text() if subtitle_el else ""

            if puesto:
                # Quitamos los saltos de linea
                puesto_limpio = puesto.replace('\n', ' ').strip()
                time = company_time.replace('\n', ' ').strip()

                exp = f"{puesto_limpio} | {time}"
        except Exception as e:
            print(f" -> Aviso menor al extraer experiencia corta: {e}")

        experience_text = exp.strip()[:95]

        # Extraer descripción / titular
        desc_element = await page.query_selector('div.text-body-medium, h2.top-card-layout__headline')
        description = await desc_element.inner_text() if desc_element else "Sin descripción"

        skill_list = []
        skill_list = []
        try:
            skill_elements = await page.query_selector_all(
                'a[data-field="skill_card_pass_through"] span[aria-hidden="true"], '
                'div[data-view-name="profile-component-entity"] span.t-bold span[aria-hidden="true"]'
            )

            for el in skill_elements:
                skill_text = await el.inner_text()
                if skill_text and skill_text.strip():
                    skill_list.append(skill_text.strip())

            skill_list = list(dict.fromkeys(skill_list))
        except Exception as e:
            print(f"Error al extraer skill: {e}")

        final_skills = ", ".join(skill_list) if skill_list else keyword

        # Preparación de datos
        return {
           "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "email": f"pendiente_{random.randint(10000, 99999)}@scraping.local",
            "location": search_location,
            "source": "LinkedIn",
            "experience": experience_text,
            "linkedin_url": url,
            "cv_url": None,
            "skills": final_skills,
            "phone": None,
            "status": "active",
            "notes": None
        }
    except Exception as e:
        print(f" Error, no se ha podido parsear {url}: {e}")
        return None

# variable Locations
async def run_scraper(keywords: list, sectors: list, locations:list, headless: bool = False):
    # Prepara la búsqueda y el scrapind de los perfiles

    print("Iniciando la busqueda de candidatos")

    # Arrancamos el navegador usando el archivo browser.py

    pw = None
    browser = None
    context = None

    try:
        pw, browser, context = await get_browser_context(headless=headless)
        # Si el navegador no se inicio bien, detemeos el script
        if context is None:
            print("Error no se pudo cargar el navegador desde browse.py")
            return

        page = await context.new_page()

        for loc in locations:
            for sector in sectors:
                for kw in keywords:
                    #Busqueda en Google
                    query = f'site:es.linkedin.com/in/ "{kw}" "{sector}" "{loc}"'
                    print (f"Buscando: '{kw}' en '{sector}' en '{loc}'")

                    #Codificamos la URL para evitar errores 404
                    encoded_query = urllib.parse.quote_plus(query)
                    await page.goto(f"https://html.duckduckgo.com/html/?q={encoded_query}")
                    await asyncio.sleep(random.uniform(3, 5))

                    # Extraer enlaces
                    raw_links = await page.locator('a').evaluate_all(
                        "elements => elements.map(e => e.href)"
                    )

                    # Limpiar las URL
                    unique_links = []
                    for link in raw_links:
                        if not link:
                            continue

                        if 'uddg=' in link:
                            #Extraemos la URL real de LinkedIn que está escondica en el parametro uddg=
                            clean_link = urllib.parse.unquote(link.split('uddg=')[1].split('&')[0])
                            if 'linkedin.com/in/' in clean_link:
                                unique_links.append(clean_link)
                        elif 'linkedin.com/in/' in link:
                            unique_links.append(link)

                    unique_links = list(set(unique_links))
                    print(f"Encontrados {len(unique_links)} posibles perfiles")

                    # Guardamos en la BD
                    async with AsyncSessionLocal() as db:
                        # Prueba solo procesamos los 2 primeros enlaces
                        for link in unique_links[:MAX_PROFILES_PER_SEARCH]:
                            candidate_data = await extract_profile_data(page, link, kw, loc)

                            if candidate_data:
                                success = await upsert_scraped_candidate(db, candidate_data)
                                if success:
                                    print(f"Guardado: {candidate_data['first_name']}{candidate_data['last_name']}")
                                else:
                                    print(f"No se pudo guardar a {candidate_data['email']}")
                            #Pausa entre perfiles
                            await asyncio.sleep(random.uniform(4, 7))

    except Exception as e:
        print(f"Error critico en scraper: {e}")
    finally:
        print("Cerrando navegador")
        try:
            if context: await context.close()
            if browser: await browser.close()
            if pw: await pw.stop()
        except:
            pass

if __name__ == "__main__":
    # Prueba de que funciona
    asyncio.run(run_scraper(
        keywords= KEYWORDS,
        sectors= SECTORS,
        locations=LOCATIONS,
        headless= HEADLESS_MODE
    ))
