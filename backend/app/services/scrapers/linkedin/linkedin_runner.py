import asyncio
import time
import re
from datetime import datetime, timezone
from bs4 import BeautifulSoup
import sys
import os

directorio_actual = os.path.dirname(os.path.abspath(__file__))
carpeta_backend = os.path.abspath(os.path.join(directorio_actual, "../../../../"))
carpeta_raiz = os.path.abspath(os.path.join(carpeta_backend, ".."))

# Le decimos a Python que busque módulos en esas carpetas
sys.path.append(carpeta_backend)
sys.path.append(carpeta_raiz)

from app.core import scraper_linkedin_config as config
from backend.app.services.scrapers.linkedin_mi.linkedin_utils import build_linkedin_url
from backend.app.services.scrapers.linkedin_mi.linkedin_browser import get_webdriver, scroll_page, fetch_job_details

#from app.services.vacancies_service import create_vacancy

async def extract_linked():
    driver = get_webdriver()
    PROCESSED_JOB_IDS = set()
    all_offers_extracted = []

    contador_ofertas = 0 
    errores_consecutivos = 0

    try:
        #Busqueda por palabras claves
        if hasattr(config, 'JOB_KEYWORD') and config.JOB_KEYWORD:
            print("Buscando por palabras claves")

            for keyword in config.JOB_KEYWORD:
                kw_limpia = keyword.replace ('"', '').strip()
                print(f"\n>> INICIANDO BÚSQUEDA POR LA PALABRA CLAVE: '{kw_limpia}'")

                for country in config.COUNTRIES:
                    print(f"Buscando ofertas en {country}.")
                    bloques_sin_novedad = 0
                    current_start = 0
                    
                    for p in range(config.PAGES):
                        if bloques_sin_novedad >= 3:
                            print("  ! Sin ofertas nuevas. Pasando a la siguiente busqueda ")
                            break

                        print(f"\n--- [BLOQUE {p+1}/{config.PAGES} - {kw_limpia}] Offset: {current_start} ---")    

                        url = build_linkedin_url(
                            kw_limpia,
                            country, 
                            config.EXPERIENCE_LEVELS,
                            config.WORKPLACE_TYPES, 
                            config.DATE_POSTED,
                            [], 
                            current_start
                        )

                        driver.get(url)
                        time.sleep(config.SCROLL_PAUSE)
                        scroll_page(driver, max_scrolls=15, scroll_pause=config.SCROLL_PAUSE)

                        soup = BeautifulSoup(driver.page_source, "html.parser")
                        job_cards = soup.find_all("div", class_="base-card")

                        if not job_cards:
                            print("       No se encontraron tarjetas. Intentando un salto mayor...")
                            current_start += 100
                            bloques_sin_novedad += 1
                            continue

                        new_in_block = 0

                        
                        # Analizar cada tarjeta individualmente
                        for card in job_cards:
                            a_tag = card.find("a", class_="base-card__full-link")
                            job_url = a_tag["href"].split("?")[0].strip() if a_tag else ""
                            if not job_url: continue

                            # Extraer el ID de forma segura
                            urn_tag = card.get('data-entity-urn')
                            if urn_tag:
                                job_id = urn_tag.split(":")[-1]
                            else:
                                match = re.search(r'-(\d+)(?:\?|$)', job_url)
                                job_id = match.group(1) if match else str(hash(job_url)) 

                            if job_id in PROCESSED_JOB_IDS: continue 

                            job_title = a_tag.find("span", class_="sr-only").text.strip() if a_tag and a_tag.find("span", class_="sr-only") else "Título no encontrado"

                            #La keyword debe de estar en el título
                            if kw_limpia.lower() not in job_title.lower():
                                continue

                            PROCESSED_JOB_IDS.add(job_id)
                            contador_ofertas += 1
                            print(f" [{contador_ofertas}] Cazando: {job_title}")

                            if contador_ofertas >= 5:
                                return all_offers_extracted

                            company_tag = card.find("h4", class_="base-search-card__subtitle")
                            company_name = company_tag.find("a").text.strip() if company_tag and company_tag.find("a") else ""
                            location_tag = card.find("span", class_="job-search-card__location")
                            location = location_tag.text.strip() if location_tag else ""

                            # Calculamos fecha
                            time_tag = card.find("time", class_="job-search-card__listdate") or card.find("time", class_="job-search-card__listdate--new")
                            publish_date = time_tag["datetime"] if time_tag and "datetime" in time_tag.attrs else None

                            if publish_date:
                                try:
                                    p_date = datetime.fromisoformat(publish_date)
                                    if p_date.tzinfo is None: p_date = p_date.replace(tzinfo=timezone.utc)
                                    diff_days = (datetime.now(timezone.utc) - p_date).days
                                    if diff_days > 14: continue
                                except Exception: pass

                            # Llamada profunda a la oferta (Selenium)
                            job_desc, company_desc, recruiter_name, recruiter_url = "", "", None, ""
                            salary, sector_text, modality = None, None, None
                            contract_time, contract_type = None, None
                            exito = False

                            try:
                                job_desc, company_desc, recruiter_name, recruiter_url, salary, sector_text,modality,contract_time,contract_type, exito = fetch_job_details(driver, job_url, config.DETAIL_PAUSE)
                            except Exception as e:
                                print(f" [!] Error al raspar oferta interna: {e}")

                            if not exito:
                                errores_consecutivos += 1
                                if errores_consecutivos >= 3:
                                    time.sleep(180)
                                    errores_consecutivos = 0 
                            else:
                                errores_consecutivos = 0 

                            texto_total = f"{str(modality)} {str(location)} {str(job_title)} {str(job_desc)}".lower()
                            
                            if re.search(r'\b(remoto|remote|teletrabajo|work from home)\b', texto_total):
                                modality = "Remoto"
                            elif re.search(r'\b(h[ií]brido|hybrid)\b', texto_total):
                                modality = "Híbrido"
                            elif re.search(r'\b(presencial|on-site|onsite|oficina)\b', texto_total):
                                modality = "Presencial"
                            else:
                                modality = None

                            # Calculo de salarios estricto para el schema
                            salary_min, salary_max = None, None
                            if salary not in [None, None, ""]:
                                texto_salario = str(salary).replace('.', '').replace(',', '')
                                numeros = re.findall(r'\d+', texto_salario)
                                if len(numeros) >= 2: salario_final = f"{numeros[0]} - {numeros[1]}"
                                elif len(numeros) == 1: salario_final = f"{numeros[0]}"

                            if not salary_min:
                                patrones = [r'([1-9]\d{1,2}(?:\.\d{3})+)\s*(?:€|euros)', r'([1-9]\d{3,4})\s*(?:€|euros)', r'([1-9]\d{1,2})\s*[kK]\b']
                                for patron in patrones:
                                    coincidencia = re.search(patron, job_desc.lower())
                                    if coincidencia:
                                        try:
                                            val = coincidencia.group(1).replace('.', '')
                                            salary_min = int(val)
                                            if "k" in patron.lower(): salary_min *= 1000
                                        except: pass
                                        break

                            # DICCIONARIO VALIDADO CONTRA ScrapedJobOffer
                            job_data = {
                                "portal_id": 3,
                                "external_id": str(job_id),
                                "title": job_title,
                                "company_name": company_name if company_name else "Empresa Confidencial",
                                "location": location,
                                "offer_url": job_url,
                                "job_description": job_desc,
                                "company_description": company_desc[:3000] if company_desc else None,
                                "published_at": publish_date, 
                                "sector": f"Keyword: {kw_limpia}",
                                "salary_min": salary_min,
                                "salary_max": salary_max,
                                "contract_type": contract_type,
                                "contract_time": contract_time,
                                "work_modality": modality,
                                "recruiter_name": recruiter_name if recruiter_name and recruiter_name != None else None,
                                "recruiter_email": None # LinkedIn rara vez da el email directo
                            }
                            
                            all_offers_extracted.append(job_data)
                            print(f"        [+] Adaptada a Schema: {job_title}")
                            
                            new_in_block += 1

                        if new_in_block == 0:
                            bloques_sin_novedad += 1
                            current_start += 100 
                        else:
                            bloques_sin_novedad = 0 
                            current_start += 50   

        #Busqueda por sectores
        print("Buscando por sectores (LinkedIn)")    

        for nombre_sector, keyword_busqueda in config.SECTORES_LINKEDIN.items():
            print(f"Iniciando búsqueda por sectores: '{nombre_sector}'")

            for country in config.COUNTRIES:
                print(f"Buscando ofertas en {country}.")
                bloques_sin_novedad = 0
                current_start = 0

                for p in range(config.PAGES):
                    if bloques_sin_novedad >= 3:
                        print(f"  ! Sin ofertas nuevas. Pasando al siguiente sector...")
                        break

                    print(f"\n--- [BLOQUE {p+1}/{config.PAGES} - {nombre_sector}] Offset: {current_start}")

                    url = build_linkedin_url(
                        keyword_busqueda,
                        country,
                        config.EXPERIENCE_LEVELS,
                        config.WORKPLACE_TYPES,
                        config.DATE_POSTED,
                        getattr(config, 'SECTORS', []),
                        current_start
                    )

                    driver.get(url)
                    time.sleep(config.SCROLL_PAUSE)
                    scroll_page(driver, max_scrolls=15, scroll_pause=config.SCROLL_PAUSE)

                    soup = BeautifulSoup(driver.page_source, "html.parser")
                    job_cards = soup.find_all("div", class_="base-card")

                    if not job_cards:
                        current_start += 100
                        bloques_sin_novedad += 1 
                        continue

                    new_in_block = 0

                    for card in job_cards:
                        a_tag = card.find("a", class_="base-card__full-link")
                        job_url = a_tag["href"].split("?")[0].strip() if a_tag else ""
                        if not job_url: continue

                        urn_tag = card.get('data-entity-urn')
                        if urn_tag:
                            job_id = urn_tag.split(":")[-1]
                        else:
                            match = re.search(r'-(\d+)(?:\?|$)', job_url)
                            job_id = match.group(1) if match else str(hash(job_url))

                        if job_id in PROCESSED_JOB_IDS: continue
                        PROCESSED_JOB_IDS.add(job_id)

                        job_title = a_tag.find("span", class_="sr-only").text.strip() if a_tag and a_tag.find("span", class_="sr-only") else None

                        contador_ofertas += 1 
                        print(f"[{contador_ofertas}] Cazando: {job_title}")

                        if contador_ofertas >= 5:
                            return all_offers_extracted
                        
                        company_tag = card.find("h4", class_="base-search-card__subtitle")
                        company_name = company_tag.find("a").text.strip() if company_tag and company_tag.find("a") else ""
                        location_tag = card.find("span", class_="job-search-card__location")
                        location = location_tag.text.strip() if location_tag else ""

                        time_tag = card.find("time", class_="job-search-card__listdate") or card.find("time", class_="job-search-card__listade--new")
                        publish_date = time_tag["datetime"] if time_tag and "datetime" in time_tag.attrs else ""

                        if publish_date:
                            try:
                                p_date = datetime.fromisoformat(publish_date)
                                if p_date.tzinfo is None: p_date = p_date.replace(tzinfo=timezone.utc)
                                diff_days = (datetime.now(timezone.utc) - p_date).days
                                if diff_days > 14: continue
                            except Exception: pass

                        job_desc, company_desc, recruiter_name, recruiter_url = "", "", None, ""
                        salary, sector_text, modality = None, None, None
                        contract_time, contract_type = None, None
                        exito = False

                        try:
                            job_desc, company_desc, recruiter_name, recruiter_url, salary, sector_text, modality, contract_time, contract_type, exito = fetch_job_details(driver, job_url, config.DETAIL_PAUSE)
                        except Exception as e:
                            print(f"        [!] Error al raspar oferta interna: {e}")

                        if not exito:
                            errores_consecutivos += 1
                            if errores_consecutivos >= 3:
                                time.sleep(180)
                                errores_consecutivos = 0 
                        else: errores_consecutivos = 0

                        texto_total = f"{str(modality)} {str(location)} {str(job_title)} {str(job_desc)}".lower()

                        if re.search(r'\b(remoto|remote|teletrabajo|work from home)\b', texto_total): modality = "Remoto"
                        elif re.search(r'\b(h[ií]brido|hybrid)\b', texto_total): modality = "Híbrido"
                        elif re.search(r'\b(presencial|on-site|onsite|oficina)\b', texto_total): modality = "Presencial"
                        else: modality = None

                        salary_min, salary_max = None, None
                        if salary not in [None, None, ""]:
                            texto_salario = str(salary).replace('.','').replace(',','')
                            numeros = re.findall(r'\d+', texto_salario)
                            if len(numeros) >= 2: salario_final = f"{numeros[0]} - {numeros[1]}"
                            elif len(numeros) == 1: salario_final = f"{numeros[0]}"

                        if not salary_min:
                            patrones = [r'([1-9]\d{1,2}(?:\.\d{3})+)\s*(?:€|euros)', r'([1-9]\d{3,4})\s*(?:€|euros)', r'([1-9]\d{1,2})\s*[kK]\b']
                            for patron in patrones:
                                coincidencia = re.search(patron, job_desc.lower())
                                if coincidencia:
                                    try:
                                        val = coincidencia.group(1).replace('.', '')
                                        salary_min = int(val)
                                        if "k" in patron.lower(): salary_min *= 1000
                                    except: pass
                                    break

                            job_data = {
                            "portal_id": 3,
                            "external_id": str(job_id),
                            "title": job_title,
                            "company_name": company_name if company_name else "Empresa Confidencial",
                            "location": location,
                            "offer_url": job_url,
                            "job_description": job_desc,
                            "company_description": company_desc[:3000] if company_desc else None,
                            "published_at": publish_date,
                            "sector": nombre_sector,
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "contract_type": contract_type,
                            "contract_time": contract_time,
                            "work_modality": modality,
                            "recruiter_name": recruiter_name if recruiter_name and recruiter_name != None else None,
                            "recruiter_email": None
                        }
                        
                        all_offers_extracted.append(job_data)
                        print(f"        [+] Adaptada a Schema: {job_title}")

                        new_in_block += 1 

                    if new_in_block == 0:
                        bloques_sin_novedad += 1
                        print(f"? Bloque sin novedades. Saltando mucho más profundo")
                        current_start += 100
                    else:
                        bloques_sin_novedad = 0
                        current_start += 50
        
        print(f"\n [✓] Scraper de LinkedIn completado. {len(PROCESSED_JOB_IDS)} ofertas enviadas al Orquestador.")
        return all_offers_extracted            

    except Exception as e:
        import traceback
        print(" ERROR CRÍTICO DETECTADO:")
        traceback.print_exc()
    finally:
        driver.quit()

#Si quieres probar el script aislado temporalmente, puedes descomentar esto:
#if __name__ == "__main__":
#     asyncio.run(run_linkedin_scraper())