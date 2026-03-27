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

    # Aceptamos cookiess para que no molesten en las siguientes páginas 
    try:
        boton = new_driver.find_element(By.ID, "didomi-notice-agree-button")
        new_driver.execute_script("arguments[0].click();", boton)
    except: pass

    return new_driver

async def fetch_infojobs_details(driver, url_oferta, url_empresa):
    """
    Visita físicamente las URLs de la oferta y de la empresa para raspar sus descripciones.
    
    MODIFICACIONES FUTURAS:
    - Aquí es donde debes cambiar las clases (ej. id="oferta-detalle") si InfoJobs 
      cambia su diseño web en el futuro.
    """
    job_description = "Descripcion no disponible"
    company_description = "Descripcion no disponible"

    # 1. Descripción de la oferta

    intentos = 0
    while intentos < 2:
        try:
            # Comprobamos si el navegador sigue en funcionamiento, si no, lo resucitamos
            try: _ = driver.window_handles
            except: driver = restart_nav(driver)

            # Pausa para que no detecte que es un robot
            await asyncio.sleep(random.uniform(2.0, 3.5))
            driver.get(url_oferta)
            await asyncio.sleep(random.uniform(2.0, 3.5))

            soup_detalle = BeautifulSoup(driver.page_source, "html.parser")

            # --- ZONA DE CAMBIO DE CLASES HTML (OFERTAS) ---
            # InfoJobs suele guardar la descripción en un div con id 'oferta-detalle'
            
            scripts_json = soup_detalle.find_all('script', type='application/ld+json')

            for script in scripts_json:
                try:
                    contenido =script.string
                    if not contenido: continue

                    data = json.loads(contenido)
                    items_a_revisar= []
                    # Buscamos la etiqueta 'JobPosting'
                    if isinstance(data, list):
                        items_a_revisar.extend(data)
                    elif isinstance(data, dict):
                        if '@graph' in data:
                            items_a_revisar.extend(data['@graph'])
                        else:
                            items_a_revisar.append(data)
                    
                    for item in items_a_revisar:
                        if item.get('@type') == 'JobPosting':
                            job_description = item.get('description', '')
                            break
                    if job_description and job_description != "Descripcion no disponible":
                        job_description = BeautifulSoup(job_description, "html.parser").get_text(separator="\n", strip=True)
                        break
                except:
                    continue

            # Plan B: Filtrado inteligente
            if not job_description or job_description == "Descripcion no disponible":
                # Destruimos ofertas similares, banners...
                for trash in soup_detalle.find_all(['aside', 'nav']):
                    trash.decompose()
                for trash in soup_detalle.find_all(attrs={"id": re.compile(r'didomi|similar|related', re.I)}):
                    trash.decompose()
                for trash in soup_detalle.find_all(attrs={"class": re.compile(r'similar|related|tags|badges', re.I)}):
                    trash.decompose()

                # 2 Buscar bloques de texto 
                filtered_blocks = soup_detalle.find_all(class_=re.compile(r'sui-Prose|description|offer-description|panel-default', re.I))

                if filtered_blocks:
                    # En lugar de usar max() para coger solo uno,
                    # extraemos el texto de TODOS los bloques válidos y los unimos.
                    # Así capturamos "Requisitos" + "Descripción" + "Qué ofrecemos".
                    valid_texts = []
                    for block in filtered_blocks:
                        text = block.get_text(separator ="\n", strip=True)
                        # Ignoramos bloque smuy cortos que pueden ser botones sueltos
                        if len(text) > 30:
                            valid_texts.append(text)
                    
                    job_description = "\n\n".join(valid_texts)

                if filtered_blocks:
                    #Ordenamos los bloques por cantidad detexto y nos quedamos con el más largo
                    best_block = max(filtered_blocks, key=lambda c:len(c.get_text(strip=True)))
                    job_description = best_block.get_text(separator="\n", strip=True)
                else:
                    # Plan C de emergencia los parrafos
                    paragraphs = soup_detalle.find_all('p')
                    texts = [p.get(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 50]
                    if texts:
                        job_description = "\n\n".join(texts)
            break
        except Exception as e:
            driver = restart_nav(driver)
            intentos += 1
    # 2. Extracción de lea descripción de la empresa

    if url_empresa and url_empresa != "https:":
        try:
            await asyncio.sleep(random.uniform(2.0, 3.0))
            driver.get(url_empresa)
            await asyncio.sleep(random.uniform(2.5, 3.5))

            soup_empresa = BeautifulSoup(driver.page_source, "html.parser")

            #Buscamos el contenedor principal de cookies (didomi) y lo destruimos
            for cookie in soup_empresa.find_all(id=re.compile(r'didomi', re.I)):
                cookie.decompose()
            # Por si acaso destruimos cualquier parrafo que hable de "consentimiento"
            for p in soup_empresa.find_all(['p', 'span']):
                text_p = p.get_text().lower()
                if "consentimiento" in text_p and "socios" in text_p:
                    p.decompose()

            # Zona de cambio de clases html (empresas)
            desc_box = soup_empresa.find("div", class_=re.compile(r"description|about|info-text|company-details", re.I))
            if desc_box:
                company_description = desc_box.get_text(separator="\n", strip=True)
            else:
                # Plan B: Buscamos todos los parrafos largos que parezcan descripciones
                parrafos = soup_empresa.find_all(['p', 'span', 'article'])
                textos_validos = [p.get_text(strip=True) for p in parrafos if len(p.get_text(strip=True)) > 40]
                if textos_validos: 
                    company_description = "\n".join(textos_validos)
        
        except Exception:
            pass # Si falla la empresa, no se rompe el programa, lo pone como "No disponible"

    # Devolvemos los textos extraídos y el driver (por si lo reiniciamos dentro de la función)
    return job_description, company_description, driver