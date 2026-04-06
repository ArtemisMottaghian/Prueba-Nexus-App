import asyncio
import re
import time
import json
import urllib.parse
from datetime import datetime
import sys
import os 
from selenium.webdriver.common.by import By

# --- PARCHE DE RUTAS ROBUSTO ---
directorio_actual = os.path.dirname(os.path.abspath(__file__))
carpeta_backend = os.path.abspath(os.path.join(directorio_actual, "../../../../")) 
carpeta_raiz = os.path.abspath(os.path.join(carpeta_backend, ".."))

sys.path.append(carpeta_backend)
sys.path.append(carpeta_raiz)

from app.core import scraper_infojobs_config as config
from app.services.scrapers.infojobs.infojobs_utils import extract_salary
from app.services.scrapers.infojobs.infojobs_browser import restart_nav, fetch_infojobs_details

async def extract_infojobs():
    """
    Función principal, no guarda en BD
    Coge las ofertas, las limpia y las devuelve a una lista de diccionarios
    """
    driver = None
    PROCESSED_JOB_IDS = set() #Para no cazar la misma ofertas dos veces en distintas páginas
    all_offers_extracted = [] # Aqui guardamos todas las ofertas extraidas

    try:
        print("Iniciando scraper de InfoJobs")
        driver = restart_nav(None)
        search_keywords = getattr(config, 'JOB_KEYWORDS', [])

        for kw in search_keywords:
            print(f"\n>> Buscando por keyword: '{kw}'")
            kw_encoded = urllib.parse.quote(kw) #Codifica espacios, ej: "Big Data" -> "Big%20Data"
            
            # Aseguramos que las páginas sean un número entero
            try:
                total_pages = int(getattr(config, 'PAGES', 3))
            except ValueError:
                total_pages = 3
                
            print(f"   [Info] Procesando {total_pages} paginas para esta keyword...")

            for page in range(1, total_pages + 1):
                # 1. Llamada a la API oculta de infojobs
                api_url = f"https://www.infojobs.net/webapp/offers/search?searchByType=country&page={page}&sortBy=PUBLICATION_DATE"
                if kw: api_url += f"&keyword={kw_encoded}"

                # =========================================================
                # BUCLE DE REINTENTOS PARA LA API (ANTIBLOQUEOS)
                # =========================================================
                intentos_api = 0
                offers = []
                
                while intentos_api < 3:
                    try: 
                        # Chequeo de seguridad: si el navegador peta, lo levantamos de nuevo
                        try: _ = driver.window_handles
                        except: driver = restart_nav(driver)

                        driver.get(api_url)
                        await asyncio.sleep(5)

                        # Gestion antiBots (DataDome)
                        page_source = driver.page_source.lower()
                        if "datadome" in page_source or "eres humano" in page_source or "actividad poco habitual" in page_source:
                            print("   [!] Captcha en API detectado. Refrescando navegador...")
                            raise Exception("Bloqueo de DataDome detectado")

                        # EXTRACCIÓN DEL JSON
                        try:
                            json_text = driver.find_element(By.TAG_NAME, "pre").text
                        except:
                            json_text = driver.find_element(By.TAG_NAME, "body").text

                        # Limpiamos espacios en blancos antes de procesar el JSON
                        json_text = json_text.strip()
                        if not json_text:
                            raise Exception("El texto JSON está vacío")

                        # Convertimos el texto a un diccionario real de Python
                        data = json.loads(json_text)
                        # 'offers' es la clave principal donde vienen todas als ofertas
                        offers = data.get("offers", [])
                        
                        # Si llegamos aquí sin errores, rompemos el bucle
                        break 
                        
                    except Exception as e:
                        print(f"      [Reintento API {intentos_api + 1}/3] Fallo al leer página {page}: {e}")
                        driver = restart_nav(driver)
                        intentos_api += 1

                print(f"   -> Ofertas detectadas en la pagina {page}: {len(offers)}")
                if not offers: break

                # =========================================================
                # 2. Procesar cada oferta del JSON
                # =========================================================
                for o in offers:
                    # Envolvemos cada oferta en un try...except para que no rompa el programa si una falla
                    try:
                        # Obtener Id para que no haya duplicados
                        jid = o.get("id", o.get("code", ""))
                        if not jid or jid in PROCESSED_JOB_IDS: continue
                        PROCESSED_JOB_IDS.add(jid)

                        # Extracción de variables del JSON
                        title = o.get("title", "Sin titulo")

                        # Con esto si la palabra clave no se encuentra en el titulo de la oferta la pasamos
                        if kw.lower() not in title.lower():
                            # El print muestra que ofertas se han descartado y por qué
                            print(f"      [Filtro] Descartada por título: '{title}' ya que buscabamos: '{kw}' ")
                            continue

                        company_name = o.get("companyName", "Empresa confidencial")
                        location = o.get("city", "España")
                        work_modality = o.get("teleworking", "Presencial").capitalize()

                        # Manejo del contrato ( a veces es un diccionario, a veces un texto)
                        c_type = o.get("contractType", None)
                        contract_type = c_type.get("value", None) if isinstance(c_type, dict) else str(c_type)
                        if contract_type == "None" or not contract_type: contract_type = None

                        # Manejo de la jornada
                        c_time = o.get("workday", None)
                        contract_time = c_time.get("value", None) if isinstance(c_time, dict) else str(c_time)
                        if contract_time == "None" or not contract_time: contract_time = None

                        # Calculo de salarios usando infojobs_utils.py
                        salary_min, salary_max = None, None
                        salary_desc = o.get("salaryDescription", "")
                        if salary_desc and "€" in salary_desc:
                            nums = extract_salary(salary_desc)
                            if nums and len(nums) == 1: salary_min = nums[0]
                            elif nums and len(nums) >= 2: salary_min, salary_max = nums[0], nums[1]

                        # Limpieza de URLs
                        url_o = o.get("link", "")
                        if url_o.startswith("//"): url_o = "https:" + url_o
                        elif url_o.startswith("/"): url_o = "https://www.infojobs.net" + url_o

                        u_company = o.get("companyLink", "")
                        if not u_company and o.get("companyId"): u_company = f"https://www.infojobs.net/{o.get('companyId')}"
                        if u_company.startswith("//"): u_company = "https:" + u_company

                        # 3. Llamada al navegador para sacar descripciones largas
                        job_description, company_description, driver = await fetch_infojobs_details(driver, url_o, u_company)


                        # Rescate de salario
                        if not salary_min and job_description:
                            # Intento 1: Buscamos el simbolo tradicional del euro
                            if "€" in job_description:
                                nums = extract_salary(job_description)
                                if nums and len(nums) == 1:
                                    salary_min = nums[0]
                                elif nums and len(nums) >= 2:
                                    salary_min, salary_max = nums[0], nums[1]

                            # Intento 2 Si siggue sin haber salrio, buscamos el formato K
                            if not salary_min:
                                #Busca un numero de dos digitos un espacio opcional y la letra K o k
                                k_match = re.findall(r'\b(\d{2})[ \t]*[kK]\b', job_description)
                                if k_match:
                                    # Convertimos el texto a entero y multiplicamos por mil
                                    salary_min = int(k_match[0]) * 1000
                                    # Si pusieron un rango atrapamos tambien el maximo
                                    if len(k_match) >= 2:
                                        salary_max = int(k_match[1]) * 1000
                        if job_description:
                            job_description = re.split(r'\n\s*(?:Referencia|Categoría)\s*\n', job_description, flags=re.IGNORECASE)[0].strip()

                            
                        job_data = {
                            "portal_id": 2,  # 2 = InfoJobs
                            "external_id": f"IJ-{jid}", 
                            "title": title,
                            "company_name": company_name if company_name else "Empresa Confidencial",
                            "location": location,
                            "offer_url": url_o, 
                            "job_description": job_description,
                            "company_description": company_description[:3000] if company_description else None, 
                            "published_at": datetime.now().isoformat(),
                            "sector": f"Keyword: {kw}",
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "contract_type": contract_type.capitalize() if contract_type else None,
                            "contract_time": contract_time.capitalize() if contract_time else None,
                            "work_modality": work_modality,
                            "recruiter_name": None, # InfoJobs no suele dar el reclutador
                            "recruiter_email": None 
                        }

                        all_offers_extracted.append(job_data)
                        print(f"      {title} | {company_name} | Guardado [✓]") 

                    except Exception as e:
                        print(f"      [!] Error procesando la oferta '{title}': {e}")
                        continue # Pasamos a la siguiente oferta sin romper la página
                    
    except Exception as e:
        import traceback
        print(f"Error crítico en el scrapeo de InfoJobs: {e}")
        traceback.print_exc()
    finally:
        if driver:
            try: driver.quit()
            except: pass
        print(f"\n [✓] Scraper de InfoJobs completado. {len(all_offers_extracted)} ofertas extraídas a memoria.")
        
    return all_offers_extracted