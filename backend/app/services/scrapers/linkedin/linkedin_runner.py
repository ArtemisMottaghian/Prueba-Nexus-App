import time
import re
import sys
import os
from datetime import datetime, timezone
from bs4 import BeautifulSoup

actual_directory = os.path.dirname(os.path.abspath(__file__))
backend_directory = os.path.abspath(os.path.join(actual_directory, "../../../../"))
root_directory = os.path.abspath(os.path.join(backend_directory, ".."))

sys.path.append(backend_directory)
sys.path.append(root_directory)

from app.core import scraper_linkedin_config as config
from app.services.scrapers.linkedin.linkedin_utils import build_linkedin_url
from app.services.scrapers.linkedin.linkedin_browser import (
    get_webdriver,
    scroll_page,
    fetch_job_details,
)
from app.services.scraper_logs_service import log_scraper_error


def is_recent_enough(publish_date_str: str | None, max_days: int = 14) -> bool:
    """
    Comprueba si la oferta fue publicada dentro del límite de días permitido.
    """
    if not publish_date_str:
        return True

    try:
        p_date = datetime.fromisoformat(publish_date_str)
        if p_date.tzinfo is None:
            p_date = p_date.replace(tzinfo=timezone.utc)
        diff_days = (datetime.now(timezone.utc) - p_date).days
        return diff_days <= max_days
    except Exception:
        return True


async def process_job_card(
    card: BeautifulSoup, driver, job_id: str, job_url: str, search_label: str
) -> dict | None:
    """
    Procesa una tarjeta individual de LinkedIn, navega al detalle y extrae los datos
    adaptados al esquema de la base de datos.
    """
    a_tag = card.find("a", class_="base-card__full-link")
    job_title_tag = a_tag.find("span", class_="sr-only") if a_tag else None
    job_title = job_title_tag.text.strip() if job_title_tag else "Título no encontrado"

    company_tag = card.find("h4", class_="base-search-card__subtitle")
    company_name = (
        company_tag.find("a").text.strip()
        if company_tag and company_tag.find("a")
        else "Empresa Confidencial"
    )

    location_tag = card.find("span", class_="job-search-card__location")
    location = location_tag.text.strip() if location_tag else ""

    time_tag = card.find("time", class_="job-search-card__listdate") or card.find(
        "time", class_="job-search-card__listdate--new"
    )
    publish_date = (
        time_tag["datetime"] if time_tag and "datetime" in time_tag.attrs else None
    )

    if not is_recent_enough(publish_date, 14):
        return None

    try:
        details = fetch_job_details(driver, job_url, config.DETAIL_PAUSE)
    except Exception as e:
        await log_scraper_error(
            error_code="SCRAPER_LINKEDIN_OFFER",
            message=f"scraper=linkedin | stage=offer_detail | url={job_url} | exc={e}",
        )
        details = {"exito": False}

    if not details.get("exito"):
        return {"error": "bloqueo"}

    modality = details.get("modality")
    job_desc = details.get("job_desc", "")
    total_text = f"{modality} {location} {job_title} {job_desc}".lower()

    if re.search(r"\b(remoto|remote|teletrabajo|work from home)\b", total_text):
        modality = "Remoto"
    elif re.search(r"\b(h[ií]brido|hybrid)\b", total_text):
        modality = "Híbrido"
    elif re.search(r"\b(presencial|on-site|onsite|oficina)\b", total_text):
        modality = "Presencial"

    salary_min = details.get("salary")

    if not salary_min:
        patterns = [
            r"([1-9]\d{1,2}(?:\.\d{3})+)\s*(?:€|euros)",
            r"([1-9]\d{3,4})\s*(?:€|euros)",
            r"([1-9]\d{1,2})\s*[kK]\b",
        ]
        for pattern in patterns:
            coincidencia = re.search(pattern, job_desc.lower())
            if coincidencia:
                try:
                    val = coincidencia.group(1).replace(".", "")
                    salary_min = int(val)
                    if "k" in pattern.lower():
                        salary_min *= 1000
                except:
                    pass
                break

    # DICCIONARIO VALIDADO CONTRA ScrapedJobOffer
    return {
        "portal_id": 3,
        "external_id": job_id,
        "title": job_title,
        "company_name": company_name,
        "location": location,
        "offer_url": job_url,
        "job_description": job_desc,
        "company_description": (
            details.get("company_desc")[:3000] if details.get("company_desc") else None
        ),
        "published_at": publish_date,
        "sector": search_label,
        "salary_min": salary_min,
        "salary_max": None,
        "contract_type": details.get("contract_type"),
        "contract_time": details.get("contract_time"),
        "work_modality": modality,
        "recruiter_name": details.get("recruiter_name"),
        "recruiter_email": None,
    }


async def extract_linked() -> list[dict]:
    """
    Función principal que orquesta el scraper de LinkedIn.
    Itera sobre las keywords y sectores configurados, navega, hace scroll y extrae las ofertas.
    """
    driver = get_webdriver()
    PROCESSED_JOB_IDS = set()
    all_offers_extracted = []

    offer_count = 0
    consecutive_errors= 0

    try:
        # Preparamos todas las búsquedas en una sola lista para evitar duplicar el código
        # Cada item tiene: (Tipo, Keyword_URL, Etiqueta_Sector, Sectores_ID)
        searches = []

        if hasattr(config, "JOB_KEYWORD") and config.JOB_KEYWORD:
            for kw in config.JOB_KEYWORD:
                searches.append(
                    (
                        "KEYWORD",
                        kw.replace('"', "").strip(),
                        f"Keyword: {kw.replace('"', '').strip()}",
                        [],
                    )
                )

        if hasattr(config, "LINKEDIN_SECTORS") and config.LINKEDIN_SECTORS:
            for sector_name, keyword_search in config.LINKEDIN_SECTORS.items():
                searches.append(
                    (
                        "SECTOR",
                        keyword_search,
                        sector_name,
                        getattr(config, "SECTORS", []),
                    )
                )

        # BUCLE PRINCIPAL DE EXTRACCIÓN
        for search_type, kw_url, label, sectors_id in searches:
            for country in getattr(config, "COUNTRIES", []):
                blocks_without_news = 0
                current_start = 0

                for p in range(getattr(config, "PAGES", 1)):
                    if blocks_without_news >= 3:
                        break

                    url = build_linkedin_url(
                        kw_url,
                        country,
                        getattr(config, "EXPERIENCE_LEVELS", []),
                        getattr(config, "WORKPLACE_TYPES", []),
                        getattr(config, "DATE_POSTED", None),
                        sectors_id,
                        current_start,
                    )

                    driver.get(url)
                    time.sleep(getattr(config, "SCROLL_PAUSE", 2))
                    scroll_page(
                        driver,
                        max_scrolls=15,
                        scroll_pause=getattr(config, "SCROLL_PAUSE", 2),
                    )

                    soup = BeautifulSoup(driver.page_source, "html.parser")
                    job_cards = soup.find_all("div", class_="base-card")

                    if not job_cards:
                        current_start += 100
                        blocks_without_news += 1
                        continue

                    new_in_block = 0

                    for card in job_cards:
                        # Extraer URL e ID básicos
                        a_tag = card.find("a", class_="base-card__full-link")
                        job_url = a_tag["href"].split("?")[0].strip() if a_tag else ""
                        if not job_url:
                            continue

                        urn_tag = card.get("data-entity-urn")
                        if urn_tag:
                            job_id = urn_tag.split(":")[-1]
                        else:
                            match = re.search(r"-(\d+)(?:\?|$)", job_url)
                            job_id = match.group(1) if match else str(hash(job_url))

                        if job_id in PROCESSED_JOB_IDS:
                            continue

                        job_data = await process_job_card(
                            card, driver, job_id, job_url, label
                        )

                        if not job_data:
                            continue

                        if "error" in job_data:
                            consecutive_errors += 1
                            if consecutive_errors >= 3:
                                time.sleep(180)
                                consecutive_errors = 0
                            continue

                        consecutive_errors = 0
                        PROCESSED_JOB_IDS.add(job_id)
                        offer_count += 1

                        all_offers_extracted.append(job_data)
                        new_in_block += 1

                        if offer_count >= getattr(
                            config, "MAX_OFFERS", 5
                        ):
                            return all_offers_extracted

                    if new_in_block == 0:
                        blocks_without_news += 1
                        current_start += 100
                    else:
                        blocks_without_news = 0
                        current_start += 50

        return all_offers_extracted

    except Exception as e:
        import traceback

        await log_scraper_error(
            error_code="SCRAPER_LINKEDIN_CRITICAL",
            message=f"scraper=linkedin | stage=critical | exc={e}",
        )
        return all_offers_extracted
    finally:
        driver.quit()

# Si quieres probar el script aislado temporalmente, puedes descomentar esto:
# if __name__ == "__main__":
#     asyncio.run(run_linkedin_scraper())
