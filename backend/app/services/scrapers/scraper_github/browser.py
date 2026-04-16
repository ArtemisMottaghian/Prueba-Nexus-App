import urllib.parse
import re
from playwright.async_api import async_playwright
import os 

async def search_linkedin_with_browser(first_name: str, last_name: str) -> str | None:
    """
    Abre un navegador oculto exclusivo para buscar el LinkedIn del candidato
    usando DuckDuckGo (evita banners de cookies de Google o Yahoo).
    """
    if not first_name or not last_name:
        return None
        
    # Formateamos la búsqueda: "Nombre Apellido" España site:linkedin.com/in/
    query = urllib.parse.quote_plus(f'"{first_name} {last_name}" España site:linkedin.com/in/')
    url = f"https://html.duckduckgo.com/html/?q={query}"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, # Siempre oculto para que no te moleste
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        try:
            # Vamos a la página de resultados de DuckDuckGo
            await page.goto(url, timeout=15000)
            
            # Extraemos todo el texto y enlaces de la página para buscar el patrón de LinkedIn
            content = await page.content()
            
            # Expresión regular para cazar cualquier enlace válido de LinkedIn en los resultados
            match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', content, re.IGNORECASE)
            
            if match:
                return match.group(1)
                
        except Exception as e:
            print(f"      ->  Error en browser_github buscando a {first_name}: {e}")
        finally:
            await browser.close()
            
    return None