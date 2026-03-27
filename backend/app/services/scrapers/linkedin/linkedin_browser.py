import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup

from backend.app.services.scrapers.linkedin_mi.linkedin_utils import parse_salary

def get_webdriver():
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--incognito")
    options.add_argument("--headless=new") 
    options.add_argument("--disable-blink-features=AutomationControlled")
    driver = webdriver.Chrome(options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    return driver

def scroll_page(driver, max_scrolls, scroll_pause):
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
    
    print(f"  -> Scroll finalizado ({scroll_count} pasos).")

def fetch_job_details(driver, job_url, detail_pause, max_retries = 2):
    job_desc, company_desc, recruiter_name, recruiter_url = "", "", "", ""
    salary, sector_id, modality = None, None, None
    contract_time, contract_type = None, None
    exito = False

    for intento in range(max_retries):
        try:
            driver.get(job_url)
            time.sleep(detail_pause + (intento * 3)) 

            WebDriverWait(driver, 8).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".description__text, .core-section-container__content, .show-more-less-html__markup"))
            )

            soup = BeautifulSoup(driver.page_source, "html.parser")

            # Salario
            insight_badges= soup.find_all("li", class_="job-details-jod-unified-topcard__job-insight")
            for badge in insight_badges:
                texto_badge = badge.get_text(strip=True).lower()
                if "€" in texto_badge or "$" in texto_badge:
                    salary = badge.get_text(strip=True)
                    
            #  Modalidad, Sector y CONTRATOS
            fit_level_div = soup.find("div", class_="job-details-fit-level-preferences")
            if fit_level_div:
                fit_text = fit_level_div.get_text(strip=True).lower()
                if any(x in fit_text for x in ["remot", "remote", "teletrabajo"]): modality = "Remoto"
                elif any(x in fit_text for x in ["hibrid", "hybrid"]): modality = "Híbrido"
                elif any(x in fit_text for x in ["presencial", "on-site"]): modality = "Presencial"

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
                        elif any(x in header_text for x in ["tipo de empleo", "employment type"]): 
                            texto_contrato = val_text
                            if " · " in texto_contrato:
                                partes = texto_contrato.split(" · ")
                                contract_time = partes[0].strip()
                                contract_type = partes[1].strip()
                            else:
                                if any (x in texto_contrato.lower() for x in ["jornada", "time", "horas"]):
                                    contract_time = texto_contrato
                                else:
                                    contract_type = texto_contrato

            # Descripción
            job_div = soup.find("div", class_="show-more-less-html__markup") or soup.find("div", class_="description__text")

            if job_div:
                texto_bruto = job_div.get_text(separator="\n", strip=True)
                lineas_limpias = [
                    linea for linea in texto_bruto.split('\n')
                    if not re.search(r'\d+\s*(vacante|solicitante\applicant|candidato)', linea.lower())
                    and not ("hace" in linea.lower() and any (x in linea.lower() for x in ["dia", "hora", "semana"]))
                ]    
                job_desc = "\n".join(lineas_limpias).strip()

                if salary == "No especificado":
                    salary_match = re.search(r'(\d{2,3}(?:\.\d{3}|\,\d{3}|k)(?:\s*€|\s*euros)?)', job_desc, re.IGNORECASE)
                    if salary_match: salary = salary_match.group(1)

            if salary != "No especificado": salary = parse_salary(salary)

            # Empresa
            company_desc = ""
            #Buscamos cualquier sección o div que hable de la empresa
            company_section = soup.find(["section", "div"], class_=re.compile(r"about-a-company|company-description|core-section-container"))
            if company_section:
                content = company_section.find("div", class_="core-section-container__content")
                if not content:
                    content = company_section.find("p")
                
                if content:
                    company_desc = content.get_text(separator="\n", strip=True)
                    if "Ver más" in company_desc:
                        company_desc = company_desc.replace("Ver más", "").strip()
            #  Reclutador
            hirer_container = soup.find("div", class_=re.compile(r"hirer-card|message-the-recruiter1job-details-jobs-unified-top-card__hirer-profile|meet-the-team"))
            
            if hirer_container:
                name_tag = hirer_container.find(["h3", "strong", "span", "h4"], calss:=re.compile(r"name|title|subtitle|profile-title"))
                if name_tag: recruiter_name = name_tag.get_text(separator= " ", strip=True)
                link_tag = hirer_container.find("a", href=lambda x: x and ("/in/" in x or "/pub/"in x))
                if link_tag:
                    recruiter_url = link_tag["href"].split("?")[0]
                    if not recruiter_name: recruiter_name = link_tag.get_text(separator= " ", strip=True)

            if not recruiter_name or not recruiter_url:
                top_card = soup.find("div", class_=re.compile(r"top-card|job-details-header"))
                if top_card:
                    fallback_link = top_card.find("a", href=lambda x: x and ("/in/" in x or "/pub/" in x))
                    if fallback_link:
                        recruiter_url = fallback_link["href"].split("?")[0]
                        recruiter_name = fallback_link.get_text(separator= " ", strip = True)

            if (not recruiter_name or not recruiter_url) and job_div:
                desc_links = job_div.find_all("a", href=lambda x: x and ("/in/" in x or "/pub/" in x))
                if desc_links:
                    recruiter_url = desc_links[0]["href"].split("?")[0]
                    recruiter_name = desc_links[0].get_text(separator=" ", strip=True)

        except Exception as e:
            print(f"      Bloqueo de LinkedIn detectado (Intento {intento+1}/{max_retries}).")
            if intento < max_retries - 1:
                print("      Refrescando la página para reintentar...")
                time.sleep(3) 

    return job_desc, company_desc, recruiter_name, recruiter_url, salary, sector_id, modality, contract_time, contract_type, exito