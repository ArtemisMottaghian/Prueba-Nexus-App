import asyncio
import aiohttp
import urllib.parse
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

async def search_google_pdfs(query: str, headless: bool = True) -> list[dict]:
    """Busca PDFs en Google y los lee en memoria RAM."""
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
                "--window-size=1920,1080"
            ]
        )

        context = await browser.new_context(
            user_agent=ua,
            viewport={'width': 1920, 'height': 1080},
            extra_http_headers={"Accept-Language": "es-ES,es;q=0.9"},
            java_script_enabled=True
        )

        page = await context.new_page()

        try:
            await Stealth().apply_stealth_async(page)
            
            try:
                accept_button = page.locator('button#L2AGLb, button:has-text("Aceptar todo"), button:has-text("Acepto")')
                if await accept_button.is_visible(timeout=3000):
                    await accept_button.click()
                    await asyncio.sleep(1.5)
            except:
                pass

            search_box = page.locator('textarea[name="q"], input[name="q"]')
            await search_box.wait_for(state="visible", timeout=10000)
            await search_box.fill(query)
            await page.keyboard.press("Enter")
            await asyncio.sleep(4) 

            all_hrefs = await page.evaluate("""() => {
                var urls = [];
                var elements = document.querySelectorAll('a');
                for (var i = 0; i < elements.length; i++) {
                    if (elements[i].href && elements[i].href.startsWith('http')) {
                        urls.push(elements[i].href);
                    }
                }
                return urls;
            }""")

            urls_to_download = []
            for href in all_hrefs:
                if 'google.' in href and '/url?' in href:
                    parsed_url = urllib.parse.urlparse(href)
                    params = urllib.parse.parse_qs(parsed_url.query)
                    if 'q' in params: href = params['q'][0]
                    elif 'url' in params: href = params['url'][0]
                
                if 'webcache.googleusercontent' in href: 
                    continue

                decoded_href = urllib.parse.unquote(href).lower()
                if ".pdf" in decoded_href and "google." not in decoded_href:
                    urls_to_download.append(href)

            urls_to_download = list(dict.fromkeys(urls_to_download))[:2]

            headers = {"User-Agent": ua, "Accept": "application/pdf", "Referer": "https://www.google.com/"}
            async with aiohttp.ClientSession(headers=headers) as session:
                for url in urls_to_download:
                    try:
                        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), ssl=False) as response:
                            if response.status == 200:
                                pdf_bytes = await response.read() 
                                if len(pdf_bytes) > 1000: 
                                    pdf_data_list.append({"url": url, "bytes": pdf_bytes})
                                    print(f" [GOOGLE] Leído en memoria: {url[:70]}...")
                    except Exception as e:
                        print(f" [GOOGLE] Error descargando PDF {url[:40]}: {e}")
        except Exception as e:
            print(f" [GOOGLE] Error en la navegación: {e}")
        finally:
            await browser.close()

    return pdf_data_list


async def search_bing_pdfs(query: str, headless: bool = True) -> list[dict]:
    """Busca PDFs en Bing como respaldo si Google falla."""
    pdf_data_list = []
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless, 
            args=[
                "--no-sandbox", 
                "--disable-dev-shm-usage", 
                "--disable-gpu",
                "--disable-blink-features=AutomationControlled"
            ]
        )

        context = await browser.new_context(
            user_agent=ua, 
            extra_http_headers={"Accept-Language": "es-ES,es;q=0.9"}
        )
        page = await context.new_page()

        try:
            await Stealth().apply_stealth_async(page)

            query_encoded = urllib.parse.quote_plus(query)
            search_url = f"https://www.bing.com/search?q={query_encoded}"
            
            await asyncio.sleep(1) # Pequeña pausa antes de navegar (simula humano)
            await page.goto(search_url, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(4) 

            all_hrefs = await page.evaluate("""() => {
                var urls = [];
                var elements = document.querySelectorAll('a');
                for (var i = 0; i < elements.length; i++) {
                    if (elements[i].href && elements[i].href.startsWith('http')) {
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
                                    pdf_data_list.append({"url": url, "bytes": pdf_bytes})
                                    print(f" [BING] Leído en memoria: {url[:70]}...")
                    except Exception as e:
                        print(f" [BING] Error descargando PDF {url[:40]}: {e}")
        except Exception as e:
            print(f" [BING] Error en la navegación: {e}")
        finally:
            await browser.close()

    return pdf_data_list