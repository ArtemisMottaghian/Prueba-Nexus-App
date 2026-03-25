import asyncio
import time
import re
from datetime import datetime, timezone
from bs4 import BeautifulSoup

from app.core import scraper_linkedin_config as config
from app.services.scrapers.linkedin_utils import build_linkedin_url
from app.services.scrapers.linkedin_browser import get_webdriver, scroll_page, fetch_job_details

from app.services.vacancies_service import create_vacancy

async def run_linkedin_scraper():
    driver = get_webdriver()
    PROCESSED_JOB_IDS = set()

    contador_ofertas = 0 
    errores_consecutivos = 0

    try:
        for nombre_sector, keyword_busqueda in config.SECTORES_LINKEDIN.items():
            print (f" INICIANDO BÚSQUEDA MASIVA: '{nombre_sector}'")

            for country in config.COUNTRIES:
                print(f"Buscando ofertas en {country}.")
                bloques_sin_novedad = 0
                current_start = 0
                
                for p in range(config.PAGES):
                    if bloques_sin_novedad >= 3:
                        if bloques_sin_novedad >= 25:
                            print("  ! Demasiados bloques seguidos sin ofertas nuevas. Fin del scraping para este sector.")
                        break

                    print(f"\n--- [BLOQUE {p+1}/{config.PAGES} - {nombre_sector}] Offset: {current_start} ---")
                    
                    url = build_linkedin_url(
                        keyword_busqueda,
                        country, config.EXPERIENCE_LEVELS,
                        config.WORKPLACE_TYPES, config.DATE_POSTED,
                        config.SECTORS, current_start
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

                    print(f"      -> Detectadas {len(job_cards)} tarjetas. Analizando nuevas...")
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
                        PROCESSED_JOB_IDS.add(job_id)

                        job_title = a_tag.find("span", class_="sr-only").text.strip() if a_tag and a_tag.find("span", class_="sr-only") else "Título no encontrado"
                        
                        contador_ofertas += 1
                        print(f"        [{contador_ofertas}] Cazando: {job_title}")

                        company_tag = card.find("h4", class_="base-search-card__subtitle")
                        company_name = company_tag.find("a").text.strip() if company_tag and company_tag.find("a") else ""
                        location_tag = card.find("span", class_="job-search-card__location")
                        location = location_tag.text.strip() if location_tag else ""

                        # Calculamos fecha
                        time_tag = card.find("time", class_="job-search-card__listdate") or card.find("time", class_="job-search-card__listdate--new")
                        publish_date = time_tag["datetime"] if time_tag and "datetime" in time_tag.attrs else ""

                        if publish_date:
                            try:
                                p_date = datetime.fromisoformat(publish_date)
                                if p_date.tzinfo is None: p_date = p_date.replace(tzinfo=timezone.utc)
                                diff_days = (datetime.now(timezone.utc) - p_date).days
                                if diff_days > 14:
                                    print(f"          - Omitiendo oferta antigua: {diff_days} días")
                                    continue
                            except Exception: pass

                        # Llamada profunda a la oferta (Selenium)
                        job_desc, company_desc, recruiter_name, recruiter_url, salary, sector_text, modality, contract_time, contract_type, exito = fetch_job_details(driver, job_url, config.DETAIL_PAUSE)

                        if not exito:
                            errores_consecutivos += 1
                            if errores_consecutivos >= 3:
                                print("\n     ALERTA: LinkedIn ha puesto el muro de Login.")
                                print("       Entrando en modo sigilo. Pausando 3 minutos...")
                                time.sleep(180)
                                errores_consecutivos = 0 
                                print("        Reanudando scraping...\n")
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
                            modality = "No especificado"

                        salario_final = None
                        if salary not in ["No especificado", None, ""]:
                            texto_salario = str(salary).replace('.', '').replace(',', '')
                            numeros = re.findall(r'\d+', texto_salario)
                            if len(numeros) >= 2:
                                salario_final = f"{numeros[0]} - {numeros[1]}"
                            elif len(numeros) == 1:
                                salario_final = f"{numeros[0]}"

                        if not salario_final:
                            patrones = [
                                r'([1-9]\d{1,2}(?:\.\d{3})+)\s*(?:€|euros)',  
                                r'([1-9]\d{3,4})\s*(?:€|euros)',              
                                r'([1-9]\d{1,2})\s*[kK]\b'                    
                            ]
                            for patron in patrones:
                                coincidencia = re.search(patron, job_desc.lower())
                                if coincidencia:
                                    salario_final = f"{coincidencia.group(1)} (Extraído texto)"
                                    print(f"         ¡Sueldo oculto cazado en el texto!: {salario_final}")
                                    break

                        
                        job_data = {
                            "external_id": job_id, 
                            "portal": "LinkedIn", 
                            "title": job_title, 
                            "offer_url": job_url,
                            "company": company_name, 
                            "company_url": (company_tag.find("a")["href"].split("?")[0] if company_tag and company_tag.find("a") else ""),
                            "description": job_desc, 
                            "company_description" : company_desc,
                            "location": location, 
                            "salary_eur": salario_final,
                            "modality": modality, 
                            "contract_time": contract_time,
                            "contract_type": contract_type,
                            "publish_date": publish_date,
                            "sector_name": nombre_sector, 
                            "recruiter_name": recruiter_name,
                            "recruiter_url": recruiter_url, 
                        }
                        
                        try:
                            await create_vacancy(job_data)
                            print(f"        [+] Guardado/Verificado en DB con éxito: {job_title}")
                        except Exception as e:
                            print(f"        [!] Error al guardar la oferta en DB: {e}")
                        
                        new_in_block += 1

                    if new_in_block == 0:
                        bloques_sin_novedad += 1
                        print(f"      ? Bloque sin novedades. Saltando mucho más profundo...")
                        current_start += 100 
                    else:
                        bloques_sin_novedad = 0 
                        current_start += 50    

        print(f"\n Scraping de todos los sectores finalizado. {len(PROCESSED_JOB_IDS)} ofertas únicas.")

    except Exception as e:
        import traceback
        print(" ERROR CRÍTICO DETECTADO:")
        traceback.print_exc()
    finally:
        driver.quit()

#Si quieres probar el script aislado temporalmente, puedes descomentar esto:
#if __name__ == "__main__":
#     asyncio.run(run_linkedin_scraper())