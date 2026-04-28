from core.scraper_candidates_linkedin_config import HEADLESS_MODE, KEYWORDS_PER_SECTOR
import os
import aiohttp # Se usará si usamos la opción de pago
from random import randint as py_randint
from typing import Optional
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from playwright.async_api import async_playwright
from schemas.candidates_schemas import CandidateCreate as CandidateSchema

load_dotenv()

#Extracción con Firecwawl + IA

async def extract_with_agent(url: str, location_fallback: str) -> Optional[dict]:
    print(f"Analizando perfil: {url}")
    try:
        page_content = ""

        #----------------------------
        # OPCION DE PAGO (Proxycurl)
        #----------------------------
        """
        try:
            api_key = os.getenvv("PROXYCURL_API_KEY")
            headers = {'Authorization': f'Bearer {api_key}'}
            endpoint = 'https://nubela.co/proxycurl/api/v2/linkedin'

            async with aiohttp.ClientSession() as session:
                async with aiohttp.get(endpoint, params={'url': url}, headers=headers) as response:
                    if response.status == 200:
                        profile_json = await response.json()
                        # Se convierte el JSON en texto para que Gemini lo lea ifual
                        page_content = str(profile_json)
                    else:
                        print(f"Error en API Proxycurl: {response.status}")
                        return None
        
        except Exception as e:
            print(f"Error con la API: {e}")
            return None
        """

        #--------------------------
        # OPCION GRATUITA (li_at)
        #--------------------------
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=HEADLESS_MODE,
                args=["--diable-blink-features=AutomationControlled"]
                )

            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            li_at_cookie = os.getenv("LINKEDIN_LI_AT")
            if li_at_cookie:
                await context.add_cookies([
                    {'name': 'li_at', 'value': li_at_cookie, 'domain': 'linkedin.com', 'path': '/'}
                ])
            
            page = await context.new_page()

            try:
                await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(py_randint(15000, 30000))
                await page.mouse.wheel(0, 800)
                await page.wait_for_timeout(py_randint(15000, 30000))

                page_content = await page.inner_text("body")
            except Exception as e:
                print(f"Tiempo de espera agotado en Playwright: {e}")
            finally:
                await browser.close()

# Validación y Gemini

        if not page_content or"authwall" in page_content.lower() or "Únete a LinkedIn" in page_content:
            print("LinkedIn bloqueó la petición. Saltando")
            return None

        llm = ChatGoogleGenerativeAI(
            model = "gemini-2.5-flash",
            temperature = 0,
            google_api_key = os.getenv("GOOGLE_AI_KEY")
        )
        llm_with_tools = llm.with_structured_output(CandidateSchema)

        prompt = f"""
        Eres un reclutador experto. Extrae la información del siguiente texto sacado de un perfil de LinkedIn.
        REGLA CRÍTICA: Si el email no es visible, genera uno siguiendo exactamente este formato: nombre_apellido@scraping.local
        
        Contenido del perfil:
        {page_content[:15000]}
        """

        extracted_data = await llm_with_tools.ainvoke(prompt)

        if not extracted_data.is_open_to_work:
            print("Descartado no esta en busqueda activa o no se pudo verificar")
            return None

        # Limpieza de datos
        candidate_dict = extracted_data.dict()
        if not candidate_dict.get("email"):
            fn = candidate_dict["first_name"].replace(" ", "").lower()
            ln = candidate_dict["last_name"].replace(" ", "").lower()
            candidate_dict["email"] = f"{fn}{ln}@sccraping.local"
            print(f"Email generado: {candidate_dict['email']}")

        candidate_dict["candidate_url"] = url
        candidate_dict["source"] = "LinkedIn"
        candidate_dict["status"] = "active"
        if not candidate_dict["location"]:
            candidate_dict["location"] = location_fallback

        return candidate_dict

    except Exception as e: 
        print(f"Error procesando {url}: {e}")
        return None 



        
    