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
    
    # Entra al perfil y obtiene la información visible publicamente
    print (f"Entrando al perfil: {url}")
    try:
        #Cogemos el perfil y que cargue el DOM
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        
        # Scroll para cargar secciones ocultas
        await page.mouse.wheel(delta_x=0, delta_y=800)
        await asyncio.sleep(1.5)
        await page.mouse.wheel(delta_x=0, delta_y=800)
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
        word_trap = [
            ' s.l.', ' s.a.', ' s.l', ' s.a', ' inc', ' sl', ' sa', ' ltd', ' llc', 'agencia', 'servicios', 'solutions', 'consulting', 'Dpto', 'Departamento', 'Departament', 'master', 'máster', 'universidad', 'escuela'
        ]
        name_lower = full_name.lower()
        if any(word in name_lower for word in word_trap):
            print(f"Saltando {url} Parece ser una empresa: {full_name}")
            return None
            
        #Limpiamos el nombre
        name_parts = full_name.strip().split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Extraer Ubicación
        loc_element = await page.query_selector('span.text-body-small.inline.t-black--light.break-words, h3.top-card-layout__first-subline')
        scraped_location = await loc_element.inner_text() if loc_element else "No especificada"

        # Extraer experiencia
        full_experience = "No visible"
        try:
            # 1. Buscamos la caja entera usando query_selector (que funciona perfecto con await)
            exp_section = await page.query_selector('section:has(h2:has-text("Experiencia")), section:has(h2:has-text("Experience")), div:has(h2:has-text("Experiencia"))')
            
            if exp_section:
                raw_text = await exp_section.inner_text()
                
                # Limpiamos el texto resultante
                lineas = [linea.strip() for linea in raw_text.split('\n') if linea.strip()]
                
                # Borramos la palabra "Experiencia" del principio
                if lineas and (lineas[0].lower() == "experiencia" or lineas[0].lower() == "experience"):
                    lineas.pop(0)
                
                full_experience = "\n".join(lineas)
            else:
                # Plan B: Extraer los bloques de trabajo uno a uno
                exp_items = await page.query_selector_all('li.experience-item, li.profile-section-card')
                if exp_items:
                    experiencias_limpias = []
                    for item in exp_items:
                        texto = await item.inner_text()
                        lineas = [linea.strip() for linea in texto.split('\n') if linea.strip()]
                        experiencias_limpias.append(" • ".join(lineas)) 
                    full_experience = "\n\n".join(experiencias_limpias)
                    
        except Exception as e:
            print(f"   -> Aviso al extraer experiencia: {e}")

        # Imprimimos la previa en consola
        preview_exp = full_experience[:80].replace("\n", " ") + "..." if full_experience != "No visible" else "No visible"
        print(f"   -> Experiencia extraída: {preview_exp}")

        # Preparación de datos
        return{
           "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "email": f"pendiente_{random.randint(10000, 99999)}@scraping.local",
            "phone": None,
            "location": search_location,
            "source": "LinkedIn",
            "experience": full_experience,
            "linkedin_url": url,
            "cv_url": None, 
            "skills": keyword,
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
                    
                    # Salto por si hay 0 resultados
                    if not unique_links:
                        print(f" 0 resultados encontrados, pasando a la siguiente")
                        continue
                    
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
