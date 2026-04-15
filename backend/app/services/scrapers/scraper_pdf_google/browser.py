import os
import asyncio
import aiohttp
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

async def search_google_pdfs(query: str):
    """
    Entra en Google, busca PDFs y lee sus BYTES directamente a la memoria RAM.
    NO descarga ni guarda ningún archivo en el disco duro.
    """
    pdf_data_list = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, 
            args=["--disable-blink-features=AutomationControlled"]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        
        page = await context.new_page()
        
        try:
            await page.goto("https://www.google.com")
            
            # Aceptar cookies
            try:
                accept_button = page.get_by_role("button", name="Aceptar todo")
                if await accept_button.is_visible():
                    await accept_button.click()
            except:
                pass

            # Buscar la query
            await page.fill('textarea[name="q"]', query)
            await page.keyboard.press("Enter")
            await page.wait_for_selector("#search")

            # Extraer enlaces
            links = await page.query_selector_all('a')
            urls_to_download = []
            
            for link in links:
                href = await link.get_attribute("href")
                if href and (".pdf" in href.lower() or "filetype:pdf" in query.lower()):
                    if href.startswith("http") and "google.com" not in href:
                        urls_to_download.append(href)
            
            urls_to_download = list(set(urls_to_download))[:5] 

            # LA MAGIA: Leer en RAM (Sin guardar archivos)
            async with aiohttp.ClientSession() as session:
                for url in urls_to_download:
                    try:
                        async with session.get(url, timeout=10, ssl=False) as response:
                            if response.status == 200:
                                pdf_bytes = await response.read() # <--- Solo leemos los bytes
                                pdf_data_list.append({"url": url, "bytes": pdf_bytes})
                                print(f"👁️ Leído en memoria sin descargar: {url}")
                    except Exception as e:
                        print(f"⚠️ Error leyendo en memoria {url}: {e}")

        except Exception as e:
            print(f"❌ Error en la navegación de Google: {e}")
        
        finally:
            await browser.close()
            
    return pdf_data_list


# Mantengo tu función original intacta por si la usas en el scraper de GitHub
async def get_browser_context(headless: bool = False):
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=headless, args=["--disable-blink-features=AutomationControlled"])
    context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    
    li_at_cookie = os.getenv ("LINKEDIN_SESSION_COOKIE")
    if li_at_cookie and li_at_cookie != "dummy_cookie":
        await context.add_cookies([{
            'name': 'li_at',
            'value': li_at_cookie,
            'domain': '.linkedin.com',
            'path': '/'
        }])
        print("Cookie de LinkedIn inyectada correctamente")
    else:
        print("El script no esta encontrando tu cookie en el .env")

    return pw, browser, context