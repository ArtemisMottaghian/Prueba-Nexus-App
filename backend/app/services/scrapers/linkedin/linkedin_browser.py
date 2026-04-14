import time
import re
from typing import Any
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup


from app.services.scrapers.linkedin.linkedin_utils import parse_salary

def get_webdriver() -> webdriver.Chrome:
    """
    Inicializa y configura un navegador Chrome en modo headless con evasión básica de bots.

    Returns:
        webdriver.Chrome: La instancia configurada del navegador.
    """

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-extensions")
    options.add_argument("--incognito")

    driver = webdriver.Chrome(options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    return driver

def scroll_page(driver: webdriver.Chrome, max_scrolls: int, scroll_pause: float) -> None:
    """
    Hace scroll infinito en la página de resultados de LinkedIn haciendo clic en 'Ver más' si es necesario.


    Args:
        driver: Instancia de Selenium WebDriver.
        max_scrolls (int): Límite máximo de veces que hará scroll.
        scroll_pause (float): Segundos a esperar entre cada scroll para permitir la carga.
    """

    last_height = driver.execute_script("return document.body.scrollHeight")
    scroll_count = 0

    while scroll_count < max_scrolls:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(scroll_pause)

        try:
            buttons = driver.find_elements(By.CSS_SELECTOR, "button.infinite-scroller__show-more-button, button[aria-label='Ver más empleos'], button[aria-label='See more jobs']")
            for btn in buttons:
                if btn.is_displayed():
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(scroll_pause)
                    break
        except Exception:
            pass

        new_height = driver.execute_script("return document.body.scrollHeight")

        if new_height == last_height:
            driver.execute_script("window.scrollBy(0, -200);")
            time.sleep(0.5)
            driver.execute_script("window.scrollBy(0, 500);")
            time.sleep(1)
            if driver.execute_script("return document.body.scrollHeight") == last_height:
                break

        last_height = new_height
        scroll_count += 1


def extract_salary_and_modality(
    soup: BeautifulSoup,
) -> tuple[int | None, str | None, str | None, str | None, str | None]:
    """
    Extrae el salario, la modalidad de trabajo (Remoto/Híbrido) y detalles del contrato.
    Función interna de ayuda para 'fetch_job_details'.
    """
    salary = None
    modality = None
    sector_id = None
    contract_time = None
    contract_type = None

    insight_badges = soup.find_all(
        "li", class_="job-details-jod-unified-topcard__job-insight"
    )
    for badge in insight_badges:
        texto_badge = badge.get_text(strip=True).lower()
        if "€" in texto_badge or "$" in texto_badge:
            salary = badge.get_text(strip=True)

    fit_level_div = soup.find("div", class_="job-details-fit-level-preferences")
    if fit_level_div:
        fit_text = fit_level_div.get_text(strip=True).lower()
        if any(x in fit_text for x in ["remot", "remote", "teletrabajo"]):
            modality = "Remoto"
        elif any(x in fit_text for x in ["hibrid", "hybrid"]):
            modality = "Híbrido"
        elif any(x in fit_text for x in ["presencial", "on-site"]):
            modality = "Presencial"

    criteria_items = soup.find_all("li", class_="description__job-criteria-item")
    for item in criteria_items:
        header = item.find("h3", class_="description__job-criteria-subheader")
        if header:
            header_text = header.text.strip().lower()
            val_span = item.find("span", class_="description__job-criteria-text")

            if val_span:
                val_text = val_span.get_text(strip=True)
                if any(x in header_text for x in ["industries", "sector", "industria"]):
                    sector_id = val_text
                elif any(x in header_text for x in ["workplace", "lugar de trabajo"]):
                    modality = val_text
                elif any(
                    x in header_text for x in ["tipo de empleo", "employment type"]
                ):
                    texto_contrato = val_text
                    if " · " in texto_contrato:
                        partes = texto_contrato.split(" · ")
                        contract_time = partes[0].strip()
                        contract_type = partes[1].strip()
                    else:
                        if any(
                            x in texto_contrato.lower()
                            for x in ["jornada", "time", "horas"]
                        ):
                            contract_time = texto_contrato
                        else:
                            contract_type = texto_contrato

    return salary, modality, sector_id, contract_time, contract_type


def extract_recruiter_info(
    soup: BeautifulSoup, job_div: BeautifulSoup | None
) -> tuple[str, str]:
    """
    Busca la información del reclutador en múltiples lugares de la página.
    Función interna de ayuda para 'fetch_job_details'.
    """
    recruiter_name = ""
    recruiter_url = ""

    hirer_container = soup.find(
        "div",
        class_=re.compile(
            r"hirer-card|message-the-recruiter|job-details-jobs-unified-top-card__hirer-profile|meet-the-team"
        ),
    )

    if hirer_container:
        name_tag = hirer_container.find(
            ["h3", "strong", "span", "h4"],
            class_=re.compile(r"name|title|subtitle|profile-title"),
        )
        if name_tag:
            recruiter_name = name_tag.get_text(separator=" ", strip=True)

        link_tag = hirer_container.find(
            "a", href=lambda x: x and ("/in/" in x or "/pub/" in x)
        )
        if link_tag:
            recruiter_url = link_tag["href"].split("?")[0]
            if not recruiter_name:
                recruiter_name = link_tag.get_text(separator=" ", strip=True)

    if not recruiter_name or not recruiter_url:
        top_card = soup.find("div", class_=re.compile(r"top-card|job-details-header"))
        if top_card:
            fallback_link = top_card.find(
                "a", href=lambda x: x and ("/in/" in x or "/pub/" in x)
            )
            if fallback_link:
                recruiter_url = fallback_link["href"].split("?")[0]
                recruiter_name = fallback_link.get_text(separator=" ", strip=True)

    if (not recruiter_name or not recruiter_url) and job_div:
        desc_links = job_div.find_all(
            "a", href=lambda x: x and ("/in/" in x or "/pub/" in x)
        )
        if desc_links:
            recruiter_url = desc_links[0]["href"].split("?")[0]
            recruiter_name = desc_links[0].get_text(separator=" ", strip=True)

    return recruiter_name, recruiter_url


def fetch_job_details(
    driver: webdriver.Chrome, job_url: str, detail_pause: float, max_retries: int = 2
) -> dict[str, Any]:
    """
    Navega a la página de detalle de una oferta y extrae toda su información.
    Devuelve un diccionario para facilitar su manejo.
    """
    result = {
        "job_desc": "",
        "company_desc": "",
        "recruiter_name": "",
        "recruiter_url": "",
        "salary": None,
        "sector_id": None,
        "modality": None,
        "contract_time": None,
        "contract_type": None,
        "exito": False,
    }

    for intento in range(max_retries):
        try:
            driver.get(job_url)
            time.sleep(detail_pause + (intento * 3))

            WebDriverWait(driver, 8).until(
                EC.presence_of_element_located(
                    (
                        By.CSS_SELECTOR,
                        ".description__text, .core-section-container__content, .show-more-less-html__markup",
                    )
                )
            )

            soup = BeautifulSoup(driver.page_source, "html.parser")

            raw_salary, modality, sector_id, c_time, c_type = (
                extract_salary_and_modality(soup)
            )
            result["modality"] = modality
            result["sector_id"] = sector_id
            result["contract_time"] = c_time
            result["contract_type"] = c_type

            job_div = soup.find(
                "div", class_="show-more-less-html__markup"
            ) or soup.find("div", class_="description__text")

            if job_div:
                texto_bruto = job_div.get_text(separator="\n", strip=True)
                lineas_limpias = [
                    linea
                    for linea in texto_bruto.split("\n")
                    if not re.search(
                        r"\d+\s*(vacante|solicitante|applicant|candidato)",
                        linea.lower(),
                    )
                    and not (
                        "hace" in linea.lower()
                        and any(x in linea.lower() for x in ["dia", "hora", "semana"])
                    )
                ]
                result["job_desc"] = "\n".join(lineas_limpias).strip()

                # Rescate de salario de la descripción
                if not raw_salary:
                    salary_match = re.search(
                        r"(\d{2,3}(?:\.\d{3}|\,\d{3}|k)(?:\s*€|\s*euros)?)",
                        result["job_desc"],
                        re.IGNORECASE,
                    )
                    if salary_match:
                        raw_salary = salary_match.group(1)

            # Usamos la utilidad que limpiamos antes para asegurar un número
            result["salary"] = parse_salary(raw_salary) if raw_salary else None

            # 3. Extraer Empresa
            company_section = soup.find(
                ["section", "div"],
                class_=re.compile(
                    r"about-a-company|company-description|core-section-container"
                ),
            )
            if company_section:
                content = company_section.find(
                    "div", class_="core-section-container__content"
                ) or company_section.find("p")
                if content:
                    desc = content.get_text(separator="\n", strip=True)
                    result["company_desc"] = desc.replace("Ver más", "").strip()

            rec_name, rec_url = extract_recruiter_info(soup, job_div)
            result["recruiter_name"] = rec_name
            result["recruiter_url"] = rec_url

            result["exito"] = True
            break

        except Exception as e:
            print(
                f"      Aviso/Bloqueo detectado (Intento {intento+1}/{max_retries}): {str(e)[:50]}..."
            )
            if intento < max_retries - 1:
                print("      Refrescando para reintentar...")
                time.sleep(3)

    return result
