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
from app.services.scraper_logs_service import log_scraper_error

# --- PARCHE DE RUTAS ROBUSTO ---
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../../"))
root_dir = os.path.abspath(os.path.join(backend_dir, ".."))

sys.path.append(backend_dir)
sys.path.append(root_dir)

from app.core import scraper_infojobs_config as config
from app.services.scrapers.infojobs.infojobs_utils import extract_salary
from app.services.scrapers.infojobs.infojobs_browser import (
    restart_nav,
    fetch_infojobs_details,
)


async def fetch_api_page(
    driver: Any, api_url: str, page: int, kw: str
) -> tuple[list[dict], Any]:
    """
    Realiza la llamada a la API oculta de InfoJobs.
    Maneja los bloqueos de DataDome, reintenta en caso de fallo y extrae el JSON.
    Devuelve las ofertas encontradas y la instancia del driver (por si tuvo que reiniciarlo).
    """
    api_attempts = 0
    offers = []

    while api_attempts < 3:
        try:
            try:
                _ = driver.window_handles
            except:
                driver = restart_nav(driver)

            driver.get(api_url)
            await asyncio.sleep(5)

            page_source = driver.page_source.lower()
            if (
                "datadome" in page_source
                or "eres humano" in page_source
                or "actividad poco habitual" in page_source
            ):
                raise Exception("Bloqueo de DataDome detectado")

            try:
                json_text = driver.find_element(By.TAG_NAME, "pre").text
            except:
                json_text = driver.find_element(By.TAG_NAME, "body").text

            json_text = json_text.strip()
            if not json_text:
                raise Exception("El texto JSON está vacío")

            data = json.loads(json_text)
            offers = data.get("offers", [])
            break

        except Exception as e:
            await log_scraper_error(
                error_code="SCRAPER_INFOJOBS_CAPTCHA",
                message=f"scraper=infojobs | stage=api_page | page={page} | kw={kw} | attempt={api_attempts + 1} | exc={e}",
            )
            driver = restart_nav(driver)
            api_attempts += 1

    return offers, driver


async def process_single_offer(
    offer: dict, kw: str, driver: Any, processed_ids: set
) -> tuple[dict | None, Any]:
    """
    Parsea los datos crudos de una única oferta de InfoJobs, navega por su detalle
    y la mapea al esquema de la base de datos (ScrapedJobOffer).
    """
    job_id = offer.get("id", offer.get("code", ""))
    if not job_id or job_id in processed_ids:
        return None, driver

    title = offer.get("title", "Sin titulo")

    processed_ids.add(job_id)

    company_name = offer.get("companyName", "Empresa confidencial")
    location = offer.get("city", "España")
    work_modality = offer.get("teleworking", "Presencial").capitalize()

    c_type = offer.get("contractType", None)
    contract_type = (
        c_type.get("value", None) if isinstance(c_type, dict) else str(c_type)
    )
    if contract_type == "None" or not contract_type:
        contract_type = None

    c_time = offer.get("workday", None)
    contract_time = (
        c_time.get("value", None) if isinstance(c_time, dict) else str(c_time)
    )
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

    details, driver = await fetch_infojobs_details(driver, job_url, company_url)

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
            r"\n\s*(?:Referencia|Categoría)\s*\n", job_description, flags=re.IGNORECASE
        )[0].strip()

    job_data = {
        "portal_id": 2,
        "external_id": f"IJ-{job_id}",
        "title": title,
        "company_name": company_name if company_name else "Empresa Confidencial",
        "location": location,
        "offer_url": job_url,
        "job_description": job_description,
        "company_description": (
            company_description[:3000] if company_description else None
        ),
        "published_at": datetime.now().isoformat(),
        "sector": f"Keyword: {kw}",
        "salary_min": salary_min,
        "salary_max": salary_max,
        "contract_type": contract_type.capitalize() if contract_type else None,
        "contract_time": contract_time.capitalize() if contract_time else None,
        "work_modality": work_modality,
        "recruiter_name": None,
        "recruiter_email": None,
    }

    return job_data, driver


async def extract_infojobs() -> list[dict]:
    """
    Función orquestadora principal.
    Itera por las palabras clave y páginas, orquestando las funciones auxiliares.
    """
    driver = None
    PROCESSED_JOB_IDS = set()
    all_offers_extracted = []

    try:
        driver = restart_nav(None)
        search_keywords = getattr(config, "JOB_KEYWORDS", [])

        for kw in search_keywords:
            kw_encoded = urllib.parse.quote(kw)

            try:
                total_pages = int(getattr(config, "PAGES", 3))
            except ValueError:
                total_pages = 3

            for page in range(1, total_pages + 1):
                api_url = f"https://www.infojobs.net/webapp/offers/search?searchByType=country&page={page}&sortBy=PUBLICATION_DATE"
                if kw:
                    api_url += f"&keyword={kw_encoded}"

                offers, driver = await fetch_api_page(driver, api_url, page, kw)

                if not offers:
                    break

                for offer in offers:
                    try:
                        job_data, driver = await process_single_offer(
                            offer, kw, driver, PROCESSED_JOB_IDS
                        )

                        if job_data:
                            all_offers_extracted.append(job_data)

                    except Exception as e:
                        await log_scraper_error(
                            error_code="SCRAPER_INFOJOBS_OFFER",
                            message=f"scraper=infojobs | stage=parse | title={offer.get('title', 'N/A')} | exc={e}",
                        )
                        continue

    except Exception as e:
        import traceback

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

    return all_offers_extracted

# if __name__ == "__main__":
#     resultados = asyncio.run(extract_infojobs())
#     print(f"Se han extraido {len(resultados)} ofertas de Adzuna.")
#     for resultado in resultados:
#         print(resultado)
