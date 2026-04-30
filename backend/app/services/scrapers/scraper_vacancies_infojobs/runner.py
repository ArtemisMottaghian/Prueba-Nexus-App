import asyncio
import re
import time
import json
import urllib.parse
from datetime import datetime
import sys
import os
from typing import Any
from selenium.webdriver.common.by import By

# Parche de rutas robusto
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../../"))
root_dir = os.path.abspath(os.path.join(backend_dir, ".."))

sys.path.append(backend_dir)
sys.path.append(root_dir)

from app.services.scraper_logs_service import log_scraper_error
from app.core import scraper_vacancies_infojobs_config as config
from app.services.scrapers.scraper_vacancies_infojobs.utils import extract_salary, upsert_job_offer, upsert_company_sql
from app.services.scrapers.scraper_vacancies_infojobs.browser import restart_nav, fetch_infojobs_details

from app.services.scrapers.scraper_companies.scraper_companies import extract_company_data
# Importaciones de base de datos configuradas para tu proyecto
from app.db.session import AsyncSessionLocal
from app.models.job_model import JobOffer


async def fetch_api_page(driver: Any, api_url: str, page: int, kw: str) -> tuple[list[dict], Any]:
    api_attempts = 0
    offers = []

    while api_attempts < 3:
        try:
            print(f"Pagina {page} | keyword={kw} | intento {api_attempts+1}")

            try:
                _ = driver.window_handles
            except:
                print("[INFO] Driver muerto, reiniciando...")
                driver = restart_nav(driver)

            driver.set_page_load_timeout(15)
            driver.get(api_url)
            await asyncio.sleep(3)

            page_source = driver.page_source.lower()

            if ("datadome" in page_source or "eres humano" in page_source or "actividad poco habitual" in page_source):
                raise Exception("Bloqueo de DataDome detectado")

            try:
                json_text = driver.find_element(By.TAG_NAME, "pre").text
            except:
                json_text = driver.find_element(By.TAG_NAME, "body").text

            json_text = json_text.strip()
            if not json_text:
                raise Exception("El texto JSON esta vacio")

            data = json.loads(json_text)
            offers = data.get("offers", [])

            print(f"{len(offers)} ofertas encontradas en pagina {page}")
            break

        except Exception as e:
            print(f"Error en fetch_api_page: {e}")
            await log_scraper_error(
                error_code="SCRAPER_INFOJOBS_CAPTCHA",
                message=f"scraper=infojobs | stage=api_page | page={page} | kw={kw} | attempt={api_attempts + 1} | exc={e}",
            )
            driver = restart_nav(driver)
            api_attempts += 1

    return offers, driver


async def process_single_offer(offer: dict, kw: str, driver: Any, processed_ids: set) -> tuple[dict | None, Any]:
    job_id = offer.get("id", offer.get("code", ""))
    if not job_id or job_id in processed_ids:
        return None, driver

    title = offer.get("title", "Sin titulo")
    processed_ids.add(job_id)

    company_name = offer.get("companyName", "Empresa confidencial")
    location = offer.get("city", "Espana")
    work_modality = offer.get("teleworking", "Presencial").capitalize()

    c_type = offer.get("contractType", None)
    contract_type = c_type.get("value", None) if isinstance(c_type, dict) else str(c_type)
    if contract_type == "None" or not contract_type:
        contract_type = None

    c_time = offer.get("workday", None)
    contract_time = c_time.get("value", None) if isinstance(c_time, dict) else str(c_time)
    if contract_time == "None" or not contract_time:
        contract_time = None

    salary_min, salary_max = None, None
    salary_desc = offer.get("salaryDescription", "")
    if salary_desc and "€" in salary_desc:
        numbers = extract_salary(salary_desc)
        if numbers and len(numbers) == 1:
            salary_min = numbers[0]
        elif numbers and len(numbers) >= 2:
            salary_min, salary_max = numbers[0], numbers[1]

    job_url = offer.get("link", "")
    if job_url.startswith("//"):
        job_url = "https:" + job_url
    elif job_url.startswith("/"):
        job_url = "https://www.infojobs.net" + job_url

    company_url = offer.get("companyLink", "")
    if not company_url and offer.get("companyId"):
        company_url = f"https://www.infojobs.net/{offer.get('companyId')}"
    if company_url.startswith("//"):
        company_url = "https:" + company_url

    print(f"[PROCESSING] Analizando: {title[:40]}")

    try:
        details, driver = await asyncio.wait_for(
            fetch_infojobs_details(driver, job_url, company_url),
            timeout=70 
        )
    except asyncio.TimeoutError:
        print(f"[WARNING] Timeout en detalles, se aborta la extraccion: {job_url}")
        driver = restart_nav(driver)
        return None, driver

    job_description = details.get("job_description")
    company_description = details.get("company_description")

    if not salary_min and job_description:
        if "€" in job_description:
            numbers = extract_salary(job_description)
            if numbers and len(numbers) == 1:
                salary_min = numbers[0]
            elif numbers and len(numbers) >= 2:
                salary_min, salary_max = numbers[0], numbers[1]

        if not salary_min:
            k_match = re.findall(r"\b(\d{2})[ \t]*[kK]\b", job_description)
            if k_match:
                salary_min = int(k_match[0]) * 1000
                if len(k_match) >= 2:
                    salary_max = int(k_match[1]) * 1000

    if job_description:
        job_description = re.split(
            r"\n\s*(?:Referencia|Categoria)\s*\n", job_description, flags=re.IGNORECASE
        )[0].strip()

    job_data = {
        "portal_id": 2,
        "external_id": f"IJ-{job_id}",
        "title": title,
        "company_name": company_name if company_name else "Empresa Confidencial",
        "company_description": company_description,
        "location": location,
        "offer_url": job_url,
        "job_description": job_description,
        "published_at": datetime.now(),
        "sector": f"Keyword: {kw}",
        "salary_min": salary_min,
        "salary_max": salary_max,
        "contract_type": contract_type.capitalize() if contract_type else None,
        "contract_time": contract_time.capitalize() if contract_time else None,
        "work_modality": work_modality,
    }

    return job_data, driver


async def extract_infojobs() -> list[dict]:
    driver = None
    db_session = None
    PROCESSED_JOB_IDS = set()
    all_offers_extracted = []
    
    MAX_GLOBAL_OFFERS = 10
    ofertas_guardadas = 0

    try:
        print(f"Iniciando scraper InfoJobs. Limite maximo: {MAX_GLOBAL_OFFERS} ofertas.")
        driver = restart_nav(None)
        
        # Iniciamos conexion a BD real con tu clase
        db_session = AsyncSessionLocal() 

        search_keywords = getattr(config, "JOB_KEYWORDS", [])

        for kw in search_keywords:
            if ofertas_guardadas >= MAX_GLOBAL_OFFERS:
                break 

            print(f"\nBuscando keyword: {kw}")
            kw_encoded = urllib.parse.quote(kw)

            try: 
                total_pages = int(getattr(config, "PAGES", 3))
            except ValueError: 
                total_pages = 3

            for page in range(1, total_pages + 1):
                if ofertas_guardadas >= MAX_GLOBAL_OFFERS:
                    break 

                print(f"Pagina {page}/{total_pages}")
                api_url = f"https://www.infojobs.net/webapp/offers/search?searchByType=country&page={page}&sortBy=PUBLICATION_DATE"
                if kw:
                    api_url += f"&keyword={kw_encoded}"

                offers, driver = await fetch_api_page(driver, api_url, page, kw)

                if not offers:
                    print("No hay mas ofertas validas en esta keyword")
                    break

                for offer in offers:
                    if ofertas_guardadas >= MAX_GLOBAL_OFFERS:
                        break 

                    try:
                        job_data, driver = await process_single_offer(offer, kw, driver, PROCESSED_JOB_IDS)

                        if job_data:
                            if job_data:
                            
                                print(f"\n--- Enriqueciendo empresa (InfoJobs): {job_data['company_name']} ---")
                                
                                # Usamos asyncio.to_thread para que la IA (que no es asíncrona) no paralice el navegador
                                company_data = await asyncio.to_thread(
                                    extract_company_data, 
                                    job_data['job_description'] or "", 
                                    job_data['company_name']
                                )

                                company_data["company_description"] = job_data.get("company_description")
                                if "contact_first_name" not in company_data: company_data["contact_first_name"] = None
                                if "contact_last_name" not in company_data: company_data["contact_last_name"] = None
                                company_data["original_offer_id"] = job_data["external_id"]
                                company_id = await upsert_company_sql(db_session, company_data)

                                if not company_id:
                                    print(" -> Descartando oferta: No se pudo establecer nombre de empresa en BD.")
                                    continue
                                    
                                # Conectamos el ID de la empresa a la oferta de InfoJobs
                                job_data['company_id'] = company_id
                                job_data['company_name'] = company_data['name'] # Por si la IA limpió el nombre de la empresa

                                # Guardamos la oferta
                                print(f"Intentando guardar oferta: {job_data['title'][:40]}")
                                exito = await upsert_job_offer(db_session, job_data, JobOffer)

                                if exito:
                                    all_offers_extracted.append(job_data)
                                    ofertas_guardadas += 1
                                    print(f"Guardada correctamente. Total: {ofertas_guardadas}/{MAX_GLOBAL_OFFERS}")
                                else:
                                    print(f"No se pudo guardar la oferta en BBDD.")

                    except Exception as e:
                        print(f"Error procesando oferta individual: {e}")
                        await log_scraper_error(
                            error_code="SCRAPER_INFOJOBS_OFFER",
                            message=f"scraper=infojobs | stage=parse | title={offer.get('title', 'N/A')} | exc={e}",
                        )
                        continue
                    
        print(f"\nProceso finalizado. Total guardado: {ofertas_guardadas} ofertas.")

    except Exception as e:
        import traceback
        print(f"[CRITICAL] Error fatal en orquestacion: {e}")
        await log_scraper_error(
            error_code="SCRAPER_INFOJOBS_CRITICAL",
            message=f"scraper=infojobs | stage=critical | exc={e}",
        )
    finally:
        if driver:
            try: 
                driver.quit()
            except: 
                pass
            
        if db_session: 
            await db_session.close()

    return all_offers_extracted

if __name__ == "__main__":
    resultados = asyncio.run(extract_infojobs())
    print("Tarea programada completada y recursos liberados.")