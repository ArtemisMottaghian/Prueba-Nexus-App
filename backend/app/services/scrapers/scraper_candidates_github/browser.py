import urllib.parse
import re
import asyncio
import random
import aiohttp


async def search_linkedin_with_browser(first_name: str, last_name: str) -> str | None:
    """
    Busca el LinkedIn del candidato usando DuckDuckGo via HTTP directo (sin browser).
    Si no hay conexión o DuckDuckGo bloquea, retorna None sin colgarse.
    """
    if not first_name or not last_name:
        return None

    query = urllib.parse.quote_plus(f'"{first_name} {last_name}" España site:linkedin.com/in/')
    search_engines = [
        {"name": "DuckDuckGo", "url": f"https://html.duckduckgo.com/html/?q={query}"},
        {"name": "Bing", "url": f"https://www.bing.com/search?q={query}"},
        {"name": "Yahoo", "url": f"https://search.yahoo.com/search?q={query}"}
    ]
    
    
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, # Siempre oculto para que no te moleste
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        for engine in search_engines:
            # Pausa humana
            pause = random.uniform(3.0, 6.0)
            await asyncio.sleep(pause)
            try:
                # Vamos a la página de resultados
                await page.goto(engine["url"], timeout=30000, wait_until="domcontentloaded")
                
                # Extraemos todo el texto y enlaces de la página para buscar el patrón de LinkedIn
                content = await page.content()
                
                # Expresión regular para cazar cualquier enlace válido de LinkedIn en los resultados
                match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', content, re.IGNORECASE)
                
                if match:
                    await browser.close()
                    print(f"-> Encontrado con {engine['name']}")
                    return match.group(1)
                
                
            except Exception as e:
                print(f"      ->  Error en browser_github buscando a {first_name}: {e}")
        
        await browser.close()
            
    return None