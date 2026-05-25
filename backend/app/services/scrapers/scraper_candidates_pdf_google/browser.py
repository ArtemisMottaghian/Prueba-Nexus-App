import asyncio
import aiohttp
import os
from app.core.scraper_candidates_pdf_config import MAX_PROFILES_PER_SEARCH, KEYWORDS, CIUDADES

async def search_brave_pdfs(query: str) -> list[dict]:
    """Busca PDFs usando la API de Brave y los lee en memoria RAM."""
    pdf_data_list = []
    
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        print("Falta la BRAVE_API_KEY en el env")
        return[]
    
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": api_key
    }
    
    search_url = "https://api.search.brave.com/res/v1/web/search"
    params = {"q": query, "count": MAX_PROFILES_PER_SEARCH }
    
    urls_to_download = []
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(search_url, headers=headers, params=params, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    results = data.get("web", {}).get("results", [])
                    
                    for item in results:
                        url = item.get("url", "")
                        if ".pdf" in url.lower():
                            urls_to_download.append(url)
                            
                else: 
                    error_text = await resp.text()
                    print(f"Error en la búsqueda en Brave API: {resp.status} - {error_text}")
        except Exception as e:
            print(f"Error de conexión: {e}")
            
    urls_to_download = list(dict.fromkeys(urls_to_download))
    
    headers_dl = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36"}
    async with aiohttp.ClientSession(headers=headers_dl) as session:
        for url in urls_to_download:
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), ssl=False) as response:
                    if response.status == 200:
                        pdf_bytes = await response.read()
                        if len(pdf_bytes) > 1000:
                            pdf_data_list.append({"url": url, "bytes": pdf_bytes})
                            print(f"Leído en memoria: {url[:70]}")
            except Exception as e:
                print(f"Error descargando PDF: {url[:40]} - {e}")
    
    return pdf_data_list