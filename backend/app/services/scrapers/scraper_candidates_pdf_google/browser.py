import asyncio
import aiohttp
from playwright.async_api import async_playwright

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
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless, 
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )

        context = await browser.new_context(user_agent=ua)
        page = await context.new_page()

        try:
            await page.goto("https://www.google.es", wait_until="domcontentloaded", timeout=30000)

            # Aceptar cookies de Google (si aparecen)
            try:
                accept_button = page.locator('button#L2AGLb, button:has-text("Aceptar todo"), button:has-text("Acepto")')
                if await accept_button.is_visible(timeout=3000):
                    await accept_button.click()
                    await asyncio.sleep(1)
            except:
                pass

            # Buscar la query
            search_box = page.locator('textarea[name="q"], input[name="q"]')
            await search_box.wait_for(state="visible", timeout=10000)
            await search_box.fill(query)
            await page.keyboard.press("Enter")

            await asyncio.sleep(3) # Pausa para dejar cargar resultados

            # Extraer enlaces con JavaScript para mayor seguridad
            all_hrefs = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a'))
                            .map(a => a.href)
                            .filter(href => href.startsWith('http') && !href.includes('google.com'));
            }""")

            urls_to_download = []
            for href in all_hrefs:
                if ".pdf" in href.lower() or "filetype:pdf" in query.lower():
                    urls_to_download.append(href)

            urls_to_download = list(set(urls_to_download))[:2] 

            # LA MAGIA: Leer en RAM (Sin guardar archivos)
            headers = {"User-Agent": ua, "Accept": "application/pdf"}
            async with aiohttp.ClientSession(headers=headers) as session:
                for url in urls_to_download:
                    try:
                        async with session.get(url, timeout=12, ssl=False) as response:
                            if response.status == 200:
                                pdf_bytes = await response.read() 
                                if len(pdf_bytes) > 1000: # Evitamos PDFs corruptos o vacíos
                                    pdf_data_list.append({"url": url, "bytes": pdf_bytes})
                                    print(f" Leído en memoria sin descargar: {url[:60]}...")
                    except Exception as e:
                        print(f" Error leyendo en memoria {url[:40]}: {e}")

        except Exception as e:
            print(f" Error en la navegación de Google: {e}")

        finally:
            await browser.close()

    return pdf_data_list
