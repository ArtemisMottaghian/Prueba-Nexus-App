import asyncio
import random
import urllib.parse
from app.db.session import AsyncSessionLocal
from .browser import get_browser_context
from .scraper_repository import upsert_scraped_candidate
from app.core.scraper_linkedin_candidatos_config import KEYWORDS, SECTORS, LOCATIONS, HEADLESS_MODE, MAX_PROFILES_PER_SEARCH

async def extract_profile_data(page, url, keyword, search_location):
    # Si topamos con una empresa la salta
    if '/company/' in url or '/school/' in url:
        return None
    
    print(f"\nEntrando al perfil: {url}")
    try:
        # Cogemos el perfil y que cargue el DOM principal
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(2)

        page_title = await page.title()
        full_name = "Candidato LinkedIn"

        # Extracción del Nombre
        name_element = await page.query_selector('h1.text-heading-xlarge, h1.top-card-layout__title, h1')
        if name_element:
            full_name = await name_element.inner_text()

        if not name_element or not full_name.strip() or full_name == "Candidato LinkedIn":
            if page_title and '-' in page_title:
                full_name = page_title.split('-')[0]
            elif page_title and '|' in page_title:
                full_name = page_title.split('|')[0]

        full_name = full_name.strip()

        # Filtrar que las empresas no entren por el nombre
        word_trap = [
            ' s.l.', ' s.a.', ' inc', ' sl', ' sa', ' ltd', ' llc', 
            'agencia', 'servicios', 'tecnología', 'solutions', 'consulting', 
            'diseño', 'marketing', 'software', 'estudio', 'desarrollo',
            'master', 'máster', 'universidad', 'escuela', 'instituto', 'academia',
            'observatorio', 'fundación', 'asociación', 'ministerio', 'ayuntamiento', 'colegio'
        ]

        name_lower = full_name.lower()
        if any(word in name_lower for word in word_trap):
            print(f"Saltando {url} Parece ser una empresa: {full_name}")
            return None
            
        # Limpiamos el nombre
        name_parts = full_name.strip().split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Scroll simulando rueda de ratón
        print("   -> Deslizando para cargar el perfil...")
        viewport = page.viewport_size
        centro_x = viewport['width'] / 2 if viewport else 600
        centro_y = viewport['height'] / 2 if viewport else 400
        await page.mouse.move(centro_x, centro_y)
        
        for _ in range(8):
            await page.mouse.wheel(0, 600)  
            await asyncio.sleep(1.2)        

        # Expandi textos grandes 
        print("   -> Expandiendo descripciones de trabajo...")
        try:
            botones_ver_mas = await page.locator('button.inline-show-more-text__button').all()
            for btn in botones_ver_mas:
                if await btn.is_visible():
                    await btn.click()
                    await asyncio.sleep(0.5) 
        except Exception:
            pass 

        # Generar email unico
        try: 
            perfil_id = url.split('/in/')[1].strip('/').split('?')[0]
        except:
            perfil_id = f"candidato_{random.randint(1000,9999)}"
            
        fake_email = f"{perfil_id}@scraping.local"
        real_email = None            

        # Extraer la información de contacto
        try:
            contact_link = await page.query_selector('a[href*="/overlay/contact-info/"], a#top-card-text-details-contact-info')
            if contact_link:
                print("   -> Abriendo información de contacto...")
                await contact_link.click()
                await asyncio.sleep(2)
                
                email_el = await page.query_selector('section.ci-email a, div.ci-email a, a[href^="mailto:"]')
                if email_el:
                    real_email = await email_el.inner_text()
                    print(f"   -> Email encontrado: {real_email.strip()}")

                close_btn = await page.query_selector('button[aria-label="Cerrar"], button[aria-label="Dismiss"]')
                if close_btn:
                    await close_btn.click()
                    await asyncio.sleep(1)
                else:
                    await page.mouse.click(10, 10)
                    await asyncio.sleep(1)
        except Exception as e:
            print(f"   -> No se pudo sacar la información de contacto")

        # Calculamos el email seguro
        final_email = real_email.strip() if real_email else fake_email

        # Extraer Ubicación
        loc_element = await page.query_selector('span.text-body-small.inline.t-black--light.break-words, h3.top-card-layout__first-subline')
        scraped_location = await loc_element.inner_text() if loc_element else search_location

        # Extracción experiencia
        full_experience = None 
        try:
            texto_crudo = await page.evaluate('''() => {
                const headers = Array.from(document.querySelectorAll('h2, h3, span, div.pvs-header__title'));
                const expH2 = headers.find(h => {
                    const txt = h.innerText ? h.innerText.toLowerCase().trim() : '';
                    return txt === 'experiencia' || txt === 'experience';
                });
                
                if (!expH2) return null;

                // Aislamos la tarjeta específica (artdeco-card) para no leer el menú superior
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
            }''')

            # Limpiamos el texto
            if texto_crudo:
                if '|||' in texto_crudo:
                    experiencias_limpias = []
                    for bloque in texto_crudo.split('|||'):
                        lineas = []
                        for linea in bloque.split('\n'):
                            l_limpia = linea.strip()
                            basura = ['mostrar más', 'ver más', '...', 'aptitudes:', 'skills:', 'ver todas']
                            if l_limpia and l_limpia.lower() not in basura:
                                lineas.append(l_limpia)
                        if lineas:
                            experiencias_limpias.append(" • ".join(lineas))
                    full_experience = "\n\n".join(experiencias_limpias)
                else:
                    lineas = []
                    for linea in texto_crudo.split('\n'):
                        l_limpia = linea.strip()
                        basura = ['experiencia', 'experience', 'mostrar más', 'ver más', '...']
                        if l_limpia and l_limpia.lower() not in basura:
                            lineas.append(l_limpia)
                    full_experience = "\n".join(lineas) if lineas else None

        except Exception as e:
            print(f"   -> Aviso al procesar experiencia: {e}")

        if full_experience and not full_experience.strip():
            full_experience = None

        preview_exp = full_experience[:80].replace("\n", " ") + "..." if full_experience else "Null"
        print(f"   -> Experiencia extraída: {preview_exp}")

        skill_list = []
        try:
            # 1. Navegamos a la pestaña de aptitudes
            clean_url = url.rstrip("/")
            skills_url = f"{clean_url}/details/skills/"

            print(f" -> Navegando a la sección de aptitudes: {skills_url}")
            await page.goto(skills_url, wait_until="domcontentloaded", timeout=15000)

            # 2. Scroll para forzar la carga de la lista completa
            await page.mouse.wheel(0, 800)
            await asyncio.sleep(1)
            await page.mouse.wheel(0, 800)
            await asyncio.sleep(1.5)

            # 3. Buscamos TODOS los contenedores que tengan "profile.skill" en su componentkey
            # Esto es a prueba de balas contra los cambios de diseño de LinkedIn
            skill_containers = await page.query_selector_all(
                'div[componentkey*="profile.skill"]'
            )

            for container in skill_containers:
                # 4. Por cada contenedor, cogemos su primer párrafo <p> (que es donde está el título)
                title_el = await container.query_selector("p")
                if title_el:
                    skill_text = await title_el.inner_text()
                    # A veces hay párrafos vacíos o saltos de línea, nos aseguramos de que haya texto
                    if skill_text and skill_text.strip():
                        skill_list.append(skill_text.strip())

            # 5. Limpiamos posibles duplicados
            skill_list = list(dict.fromkeys(skill_list))

            print(
                f" -> ¡Se han extraído {len(skill_list)} aptitudes reales de la página!"
            )

        except Exception as e:
            print(f" -> Aviso al extraer skills en la página de detalles: {e}")

        # Si encontramos skills las unimos con comas, si falla, usamos la keyword
        final_skills = ", ".join(skill_list) if skill_list else keyword


        # Preparación de datos final
        return {
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "email": final_email,
            "phone": None,
            "location": scraped_location,
            "source": "LinkedIn",
            "experience": full_experience, 
            "linkedin_url": url,
            "cv_url": None,
            "skills": final_skills, 
            "status": "active",
            "notes": None
        }
    except Exception as e: 
        print(f"Error, no se ha podido parsear {url}: {e}")
        return None

# ==============================================================================
# MOTOR PRINCIPAL DEL SCRAPER
# ==============================================================================
async def run_scraper(keywords: list, sectors: list, locations: list, headless: bool = False):
    print(f"Iniciando la busqueda de candidatos (headless={headless})")

    pw = None
    browser = None
    context = None

    try:
        pw, browser, context = await get_browser_context(headless=headless)
        if context is None:
            print("Error no se pudo cargar el navegador desde browser.py")
            return

        page = await context.new_page()

        for loc in locations:
            for sector in sectors:
                for kw in keywords:
                    # Búsqueda normal en DuckDuckGo (Sin filtros extra)
                    query = f'site:es.linkedin.com/in/ "{kw}" "{sector}" "{loc}"'
                    print(f"Buscando: '{kw}' en '{sector}' en '{loc}'")

                    encoded_query = urllib.parse.quote_plus(query)
                    
                    # Evadir bloqueos de DuckDuckGo
                    await page.goto("https://html.duckduckgo.com/html/", wait_until="domcontentloaded")
                    await asyncio.sleep(random.uniform(1, 2))
                    await page.goto(f"https://html.duckduckgo.com/html/?q={encoded_query}", wait_until="domcontentloaded")
                    await asyncio.sleep(random.uniform(3, 5))

                    raw_links = await page.locator('a').evaluate_all(
                        "elements => elements.map(e => e.href)"
                    )

                    unique_links = []
                    for link in raw_links:
                        if not link:
                            continue

                        if 'uddg=' in link:
                            clean_link = urllib.parse.unquote(link.split('uddg=')[1].split('&')[0])
                            if 'linkedin.com/in/' in clean_link:
                                unique_links.append(clean_link)
                        elif 'linkedin.com/in/' in link:
                            unique_links.append(link)

                    unique_links = list(set(unique_links))
                    
                    if not unique_links:
                        print(f"0 resultados encontrados, pasando a la siguiente búsqueda.")
                        continue
                    
                    print(f"Encontrados {len(unique_links)} posibles perfiles.")

                    # Guardamos en la BD
                    async with AsyncSessionLocal() as db:
                        for link in unique_links[:MAX_PROFILES_PER_SEARCH]:
                            candidate_data = await extract_profile_data(page, link, kw, loc)

                            if candidate_data:
                                success = await upsert_scraped_candidate(db, candidate_data)
                                if success:
                                    print(f"Guardado en BD: {candidate_data['first_name']} {candidate_data['last_name']}")
                                else:
                                    print(f"No se pudo guardar a {candidate_data['email']} en la BD")
                            
                            # Pausa entre perfiles
                            await asyncio.sleep(random.uniform(4, 7))

    except Exception as e:
        print(f"Error critico en scraper: {e}")
    finally:
        print("Cerrando navegador...")
        try:
            if context: await context.close()
            if browser: await browser.close()
            if pw: await pw.stop()
        except:
            pass

if __name__ == "__main__":
    asyncio.run(run_scraper(
        keywords=KEYWORDS,
        sectors=SECTORS,
        locations=LOCATIONS,
        headless=HEADLESS_MODE
    ))