import time
import asyncio
import random
import re
import json
from typing import Any
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from seleniumbase import Driver

def get_webdriver() -> Any:
    """
    Inicia el navegador vitaminado de SeleniumBase.
    """

    #uc=True activa el motor anti-DatoDome/Cloudflare
    #headless= True lo hace invisible para que funcione en Google Cloud
    return Driver(uc=True, headless2=True, 
                  no_sandbox=True)

def restart_nav(old_driver: Any) -> Any:
    """Resucita el navegador si hay captcha o colapso"""

    if old_driver:
        try: old_driver.quit()
        except: pass

    new_driver = get_webdriver()
    new_driver.get("https://www.infojobs.net")
    time.sleep(4)

    # Aceptamos cookies para que no molesten en las siguientes páginas 
    try:
        agree_button = new_driver.find_element(By.ID, "didomi-notice-agree-button")
        new_driver.execute_script("arguments[0].click();", agree_button)
    except: pass

    return new_driver

async def fetch_infojobs_details(driver: Any, job_url: str, company_url: str) -> tuple[dict[str, Any], Any]:
    """
    Visita físicamente las URLs de la oferta y de la empresa para raspar sus descripciones.
    Devuelve un diccionario con los datos y la instancia del navegador por si hubo que reiniciarlo.
    """

    details = {
        "job_description": None,
        "company_description": None,
        "success": False
    }

    attempts = 0
    while attempts < 2:
        try:
            try: 
                _ = driver.window_handles
            except: 
                driver = restart_nav(driver)
                
            driver.set_page_load_timeout(15)

            await asyncio.sleep(random.uniform(3.0, 4.5))
            driver.get(job_url)
            await asyncio.sleep(random.uniform(3.0, 4.5))

            # --- DETECTOR DE CAPTCHAS Y BLOQUEOS ---
            page_source_lower = driver.page_source.lower()
            if "actividad poco habitual" in page_source_lower or "datadome" in page_source_lower or "máquina" in page_source_lower:
                raise Exception("Captcha detectado en la oferta")

            detail_soup = BeautifulSoup(driver.page_source, "html.parser") # Changed from: soup_detalle

            for trash in detail_soup.find_all(['aside', 'nav', 'footer', 'header', 'button', 'form']):
                trash.decompose()
            for trash in detail_soup.find_all(class_=re.compile(r'btn|button|similar|related|tags|badges|card', re.I)):
                trash.decompose()

            for title in detail_soup.find_all(['h2', 'h3', 'p']):
                if "ofertas similares" in title.get_text().lower() or "empleo similares" in title.get_text().lower():
                    parent = title.find_parent(['section', 'div', 'ul'])
                    if parent: 
                        parent.decompose()

            json_scripts = detail_soup.find_all('script', type='application/ld+json')
            for script in json_scripts:
                try:
                    content = script.string
                    if not content: continue
                    data = json.loads(content)
                    items_to_check = []

                    if isinstance(data, list): 
                        items_to_check.extend(data)
                    elif isinstance(data, dict):
                        if '@graph' in data: 
                            items_to_check.extend(data['@graph'])
                        else: 
                            items_to_check.append(data)

                    for item in items_to_check:
                        if item.get('@type') == 'JobPosting':
                            details["job_description"] = item.get('description', '')
                            break

                    if details["job_description"]:
                        details["job_description"] = BeautifulSoup(details["job_description"], "html.parser").get_text(separator="\n", strip=True)
                        # Si el resumen está cortado se vacía para activar el plan B
                        if "[...]" in details["job_description"] or len(details["job_description"]) < 150:
                            details["job_description"] = None
                        else:
                            break
                except: 
                    continue

            # --- PLAN B: FILTRADO INTELIGENTE ---
            if not details["job_description"]:
                desc_container = detail_soup.select_one('[data-test="offer-description"], #offer-description, .sui-Prose, .js-offer-description, .offer-description, .panel-body')
                if desc_container:
                    details["job_description"] = desc_container.get_text(separator="\n", strip=True)

                # --- PLAN C: BÚSQUEDA INTELIGENTE POR ENCABEZADO ---
                if not details["job_description"] or len(details["job_description"]) < 100:
                    header = detail_soup.find(lambda tag: tag.name in ['h2', 'h3'] and 'descripción' in tag.get_text(strip=True).lower())
                    if header:
                        desc_texts = []
                        for sibling in header.find_next_siblings():
                            if sibling.name in ['h2', 'h3'] and sibling.get_text(strip=True):
                                break
                            text = sibling.get_text(separator="\n", strip=True)
                            if text:
                                desc_texts.append(text)
                        if desc_texts:
                            details["job_description"] = "\n\n".join(desc_texts)

                if details["job_description"] and len(details["job_description"]) < 50:
                    details["job_description"] = None

            break
        except Exception:
            driver = restart_nav(driver)
            attempts += 1

    if company_url and company_url != "https:":
        try:
            await asyncio.sleep(random.uniform(2.5, 4.0))
            driver.get(company_url)
            await asyncio.sleep(random.uniform(2.5, 4.0))

            page_source_lower = driver.page_source.lower()
            if (
                "actividad poco habitual" in page_source_lower
                or "datadome" in page_source_lower
                or "máquina" in page_source_lower
            ):
                raise Exception("Captcha detectado en la empresa")

            company_soup = BeautifulSoup(
                driver.page_source, "html.parser"
            )
            for cookie in company_soup.find_all(id=re.compile(r"didomi", re.I)):
                cookie.decompose()
            for p in company_soup.find_all(["p", "span"]):
                text_p = p.get_text().lower()
                if "consentimiento" in text_p and "socios" in text_p:
                    p.decompose()

            desc_box = company_soup.find(
                "div",
                class_=re.compile(r"description|about|info-text|company-details", re.I),
            )
            if desc_box:
                details["company_description"] = desc_box.get_text(
                    separator="\n", strip=True
                )
            else:
                paragraphs = company_soup.find_all(
                    ["p", "span", "article"]
                )
                valid_texts = [
                    p.get_text(strip=True)
                    for p in paragraphs
                    if len(p.get_text(strip=True)) > 40
                ]
                if valid_texts:
                    details["company_description"] = "\n".join(valid_texts)
                else:
                    details["company_description"] = None
        except Exception:
            pass

    if details["job_description"]:
        details["job_description"] = re.split(
            r"\n\s*Categoria\s*\n", details["job_description"], flags=re.IGNORECASE
        )[0].strip()
        details["success"] = (
            True
        )

    return details, driver
