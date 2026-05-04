import asyncio
import aiohttp
import urllib.parse
from playwright.async_api import async_playwright
from app.core.scraper_candidates_pdf_config import HEADLESS_MODE, KEYWORDS, SECTORES, CIUDADES
import re

async def search_google_pdfs(query: str, headless: bool = True) -> list[dict]:
    """
    Realiza una búsqueda en Google para encontrar archivos PDF y descarga su contenido
    binario directamente a la memoria RAM sin guardarlos en disco.

    Args:
        query (str): La cadena de búsqueda para Google.
        headless (bool): Indica si el navegador debe ejecutarse en modo oculto.

    Returns:
        list[dict]: Una lista de diccionarios, cada uno con la 'url' y los 'bytes' del PDF.
    """
    
    pdf_data_list = []
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless, 
            args=[
                "--disable-blink-features=AutomationControlled", 
                "--no-sandbox",
                "--disable-dev-shm-usage", 
                "--disable-gpu",
                "--window-size=1920,1080"]
        )

        context = await browser.new_context(
            user_agent=ua,
            viewport={'width': 1920, 'height': 1080},
            extra_http_headers={"Accept-Language": "es-ES,es;q=0.9"}
            )
        
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = await context.new_page()

        try:
            await page.goto("https://www.google.com/ncr", wait_until="domcontentloaded", timeout=15000)

            # Aceptar cookies de Google (si aparecen)
            try:
                accept_button = page.locator('button#L2AGLb, button:has-text("Aceptar todo"), button:has-text("Acepto")')
                if await accept_button.is_visible(timeout=3000):
                    await accept_button.click()
                    await asyncio.sleep(1.5)
            except:
                pass

            # Buscar la query
            search_box = page.locator('textarea[name="q"], input[name="q"]')
            await search_box.wait_for(state="visible", timeout=10000)
            await search_box.fill(query)
            await page.keyboard.press("Enter")

            await asyncio.sleep(4) # Pausa para dejar cargar resultados

            # Extraer enlaces con JavaScript para mayor seguridad
            all_hrefs = await page.evaluate("""() => {
                var urls = [];
                var elements = document.querySelectorAll('a');
                for (var i = 0; i < elements.length; i++){
                    if (elements[i].href && elements[i].href.startsWith('http')){
                        urls.push(elements[i].href); 
                    }
                }
                return urls;
            }""")

            urls_to_download = []
            
            for href in all_hrefs:
                if "google." in href and '/url?' in href:
                    parsed_url = urllib.parse.urlparse(href)
                    params = urllib.parse.parse_qs(parsed_url.query)
                    if 'q' in params:
                       href = params['q'][0]
                    elif 'url' in params:
                        href = params['url'][0]
                        
                if 'webcache.googleusercontent' in href:
                    continue
                
                decoded_href = urllib.parse.unquote(href).lower()
                
                if ".pdf" in decoded_href and "google.com" not in decoded_href:
                    urls_to_download.append(href) 

            urls_to_download = list(dict.fromkeys(urls_to_download))[:2] 

            # Leer en RAM sin guardar archivos
            headers = {
                "User-Agent": ua,
                "Accept": "application/pdf",
                "Referer": "https://www.google.com/"
            }
            
            async with aiohttp.ClientSession(headers=headers) as session:
                for url in urls_to_download:
                    try:
                        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), ssl=False) as response:
                            if response.status == 200:
                                pdf_bytes = await response.read() 
                                if len(pdf_bytes) > 1000: 
                                    pdf_data_list.append({"url": url, "bytes": pdf_bytes})
                                    print(f" Leído en memoria sin descargar: {url[:70]}...")
                    except Exception as e:
                        print(f" Error leyendo en memoria {url[:40]}: {e}")

        except Exception as e:
            print(f" Error en la navegación de Google: {e}")
        finally:
            await browser.close()

    return pdf_data_list

async def search_bing_pdfs(query: str, headless= HEADLESS_MODE) -> list[dict]:
    """Buscar PDFs en Bing como respaldo si Google falla"""
    pdf_data_list = []
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=HEADLESS_MODE,
            args=["--no-sandbox", "--disble-dev-shm-usage", "--disable-gpu"]
        )
        
        context = await browser.new_context(user_agent=ua, extra_http_headers={"Accept-Language": "es-ES,es;q=0.9"})
        page = await context.new_page()
        
        try:
            query_encoded = urllib.parse.quote_plus(query)
            search_url = f"https://www.bing.com/search?q={query_encoded}"
            
            await page.goto(search_url, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(4)
            
            all_hrefs = await page.evaluate("""() => {
                var urls = [];
                var elements = document.querySelectorAll('a');
                for (var i = 0; i < elements.length; i++){
                    if (elements[i].href && elements[i].href.startsWith('http')){
                        urls.push(elements[i].href);
                    }
                }
                return urls;
            }""")
            
            urls_to_download = []
            for href in all_hrefs:
                decoded_href = urllib.parse.unquote(href).lower()
                if ".pdf" in decoded_href and "bing.com" not in decoded_href and "microsoft.com" not in decoded_href:
                    urls_to_download.append(href)
                    
            urls_to_download = list(dict.fromkeys(urls_to_download))[:2]
            
            headers = {"User-Agent": ua, "Accept": "application/pdf", "Referer": "https://www.bing.com/"}
            async with aiohttp.ClientSession(headers=headers) as session:
                for url in urls_to_download:
                    try:
                        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), ssl=False) as response:
                            if response.status == 200:
                                pdf_bytes = await response.read()
                                if len(pdf_bytes) > 1000:
                                    pdf_data_list.append({"url": url, "bytes":pdf_bytes})
                                    print(f"Leido en Bing en memoria: {url[:70]}")
                    except Exception as e:
                        print(f" Error descargando PDF de Bing {url[:40]}: {e}")
                        
        except Exception as e:
            print(f"Error en la navegación de Bing: {e}")
        finally:
            await browser.close()
    
    return pdf_data_list


async def search_duckduckgo_pdfs(query: str) -> list[dict]:
    """Buscar PDFs en DuckDuckGo HTML sin navegador como alternativa a Google/Bing"""
    pdf_data_list = []
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

    headers = {
        "User-Agent": ua,
        "Accept-Language": "es-ES,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
        "Referer": "https://duckduckgo.com/"
    }

    query_encoded = urllib.parse.quote_plus(query)
    url = f"https://html.duckduckgo.com/html/?q={query_encoded}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    html = await resp.text()

                    urls_to_download = []
                    for href in re.findall(r'href=["\']([^"\']+)["\']', html):
                        href = urllib.parse.unquote(href)
                        if ".pdf" in href.lower() and href.startswith("http") and "duckduckgo.com" not in href:
                            urls_to_download.append(href)

                    urls_to_download = list(dict.fromkeys(urls_to_download))[:2]

                    dl_headers = {"User-Agent": ua, "Accept": "application/pdf"}
                    async with aiohttp.ClientSession(headers=dl_headers) as dl_session:
                        for pdf_url in urls_to_download:
                            try:
                                async with dl_session.get(pdf_url, timeout=aiohttp.ClientTimeout(total=15),
                                                          ssl=False) as response:
                                    if response.status == 200:
                                        pdf_bytes = await response.read()
                                        if len(pdf_bytes) > 1000:
                                            pdf_data_list.append({"url": pdf_url, "bytes": pdf_bytes})
                                            print(f"Leído en DuckDuckGo: {pdf_url[:70]}...")
                            except Exception as e:
                                print(f"Error descargando PDF de DDG {pdf_url[:40]}: {e}")
                else:
                    print(f"DuckDuckGo bloqueó la búsqueda (Error {resp.status})")
    except Exception as e:
        print(f"Error en DuckDuckGo: {e}")

    return pdf_data_list
            