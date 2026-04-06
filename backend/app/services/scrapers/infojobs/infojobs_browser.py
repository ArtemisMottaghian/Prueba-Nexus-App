import time
import asyncio
import random
import re
import json
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from seleniumbase import Driver

def get_webdriver():
    """
    Inicia el navegador vitaminado de SeleniumBase.
    
    MODIFICACIONES FUTURAS:
    - Si InfoJobs te bloquea mucho, puedes probar a cambiar 'headless=True' a 'headless=False' 
      durante las pruebas locales para ver qué está pasando en la pantalla.
    """
    #uc=True activa el motor anti-DatoDome/Cloudflare
    #headless= True lo hace invisible para que funcione en Google Cloud
    return Driver(uc=True, headless=True, no_sandbox=True)

def restart_nav(driver_antiguo):
    """Resucita el navegador si hay captcha o colapso"""
    if driver_antiguo:
        try: driver_antiguo.quit()
        except: pass

    new_driver = get_webdriver()
    new_driver.get("https://www.infojobs.net")
    time.sleep(4)

    # Aceptamos cookies para que no molesten en las siguientes páginas 
    try:
        boton = new_driver.find_element(By.ID, "didomi-notice-agree-button")
        new_driver.execute_script("arguments[0].click();", boton)
    except: pass

    return new_driver

async def fetch_infojobs_details(driver, url_oferta, url_empresa):
    """
    [TUS COMENTARIOS] Visita físicamente las URLs de la oferta y de la empresa para raspar sus descripciones.
    """
    job_description = None
    company_description = None

    # =========================================================
    # 1. EXTRACCIÓN DE LA DESCRIPCIÓN DE LA OFERTA
    # =========================================================
    intentos = 0
    while intentos < 2:
        try:
            try: _ = driver.window_handles
            except: driver = restart_nav(driver)

            await asyncio.sleep(random.uniform(3.0, 4.5))
            driver.get(url_oferta)
            await asyncio.sleep(random.uniform(3.0, 4.5))

            # --- DETECTOR DE CAPTCHAS Y BLOQUEOS ---
            page_source_lower = driver.page_source.lower()
            if "actividad poco habitual" in page_source_lower or "datadome" in page_source_lower or "máquina" in page_source_lower:
                print("      [!] InfoJobs detectó el bot en la oferta. Reiniciando navegador...")
                raise Exception("Captcha detectado en la oferta")

            soup_detalle = BeautifulSoup(driver.page_source, "html.parser")
            
            # Limpieza previa para no ensuciar la extracción
            for trash in soup_detalle.find_all(['aside', 'nav', 'footer', 'header', 'button', 'form']):
                trash.decompose()
            for trash in soup_detalle.find_all(class_=re.compile(r'btn|button|similar|related|tags|badges|card', re.I)):
                trash.decompose()

            # Borrado de la caja "Ofertas similares"
            for title in soup_detalle.find_all(['h2', 'h3', 'p']):
                if "ofertas similares" in title.get_text().lower() or "empleo similares" in title.get_text().lower():
                    padre = title.find_parent(['section', 'div', 'ul'])
                    if padre: padre.decompose()

            scripts_json = soup_detalle.find_all('script', type='application/ld+json')
            for script in scripts_json:
                try:
                    contenido = script.string
                    if not contenido: continue
                    data = json.loads(contenido)
                    items_a_revisar = []
                    
                    if isinstance(data, list): items_a_revisar.extend(data)
                    elif isinstance(data, dict):
                        if '@graph' in data: items_a_revisar.extend(data['@graph'])
                        else: items_a_revisar.append(data)
                    
                    for item in items_a_revisar:
                        if item.get('@type') == 'JobPosting':
                            job_description = item.get('description', '')
                            break

                    if job_description:
                        job_description = BeautifulSoup(job_description, "html.parser").get_text(separator="\n", strip=True)
                        # Si el resumen esta cortado se vacia para activar el plan B
                        if "[...]" in job_description or len(job_description) < 150:
                            job_description = None
                        else:
                            break
                except: continue

            # --- PLAN B: FILTRADO INTELIGENTE ---
            if not job_description:
                
                desc_container = soup_detalle.select_one('[data-test="offer-description"], #offer-description, .sui-Prose, .js-offer-description, .offer-description, .panel-body')
                if desc_container:
                    job_description = desc_container.get_text(separator="\n", strip=True)

                # --- PLAN C: BUSQUEDA INTELIGENTE POR ENCABEZADO ---
                if not job_description or len(job_description) < 100:
                    header = soup_detalle.find(lambda tag: tag.name in ['h2', 'h3'] and 'descripción' in tag.get_text(strip=True).lower())
                    if header:
                        desc_texts = []
                        # Recorremos todos los elementos que hay DEBAJO del Título "Descripción"
                        for sibling in header.find_next_siblings():
                            # Si chocamos con otro titulo prinicpal (ej: "Requisitos") paramos de leer
                            if sibling.name in ['h2', 'h3'] and sibling.get_text(strip=True):
                                break
                            text = sibling.get_text(separator="\n", strip=True)
                            if text:
                                desc_texts.append(text)
                        if desc_texts:
                            job_description = "\n\n".join(desc_texts)
                # Validación final de seguridad
                if job_description and len(job_description) < 50:
                    job_description = None
                        
            break
        except Exception as e:
            driver = restart_nav(driver)
            intentos += 1

    # =========================================================
    # 2. EXTRACCIÓN DE LA DESCRIPCIÓN DE LA EMPRESA
    # =========================================================
    if url_empresa and url_empresa != "https:":
        try:
            await asyncio.sleep(random.uniform(2.5, 4.0))
            driver.get(url_empresa)
            await asyncio.sleep(random.uniform(2.5, 4.0))

            page_source_lower = driver.page_source.lower()
            if "actividad poco habitual" in page_source_lower or "datadome" in page_source_lower or "máquina" in page_source_lower:
                print("      [!] InfoJobs detectó el bot en la empresa. Reiniciando...")
                raise Exception("Captcha detectado en la empresa")

            soup_empresa = BeautifulSoup(driver.page_source, "html.parser")
            for cookie in soup_empresa.find_all(id=re.compile(r'didomi', re.I)): cookie.decompose()
            for p in soup_empresa.find_all(['p', 'span']):
                text_p = p.get_text().lower()
                if "consentimiento" in text_p and "socios" in text_p: p.decompose()

            desc_box = soup_empresa.find("div", class_=re.compile(r"description|about|info-text|company-details", re.I))
            if desc_box:
                company_description = desc_box.get_text(separator="\n", strip=True)
            else:
                parrafos = soup_empresa.find_all(['p', 'span', 'article'])
                textos_validos = [p.get_text(strip=True) for p in parrafos if len(p.get_text(strip=True)) > 40]
                if textos_validos: company_description = "\n".join(textos_validos)
                else: company_description = None
        except Exception: pass 


    # =========================================================
    # 3. LIMPIEZA FINAL DE DATOS
    # =========================================================

    if job_description:
        # re.split divide el texto usando la palabra "Categoría" (ignorando mayúsculas/minúsculas).
        # El [0] significa que nos quedamos únicamente con el trozo de texto ANTERIOR a esa palabra.
        job_description = re.split(r'\n\s*Categoria\s*\n', job_description, flags=re.IGNORECASE)[0].strip()
        
    return job_description, company_description, driver