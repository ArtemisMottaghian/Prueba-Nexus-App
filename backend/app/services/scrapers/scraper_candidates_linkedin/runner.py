from aiohttp.web import get
import os
import asyncio
from typing import List, Dict, Any
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from .agent_runner import extract_with_agent
from app.core.scraper_candidates_linkedin_config import KEYWORDS_PER_SECTOR

load_dotenv()

async def search_profiles(term: str, location: str, keywords: List[str] = None) -> List[str]:
    """
    Busca perfiles de LinkedIn usando el motor de búsqueda de Firecrawl.
    No requiere Google API Key.
    """
    print(f"-> Buscando perfiles para: '{term}' en '{location}' vía Firecrawl...")
    
    keywords_str = ""
    if keywords:
        keywords_str = " " + " ".join([f'"{kw}"' for kw in keywords])
    try:
        app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
        termino_limpio = term.split(" OR ")[0].strip()
    
        query = f"site:linkedin.com/in/ {termino_limpio} {location} {keywords_str}"
        print(f"Query enviada al buscador: {query}")
        
        search_results = app.search(query, limit=10)
        print(f"Respuesta Firecrawl: {search_results}")
        links = []
        
        web_results= getattr(search_results, 'web', None)
        if web_results is None and isinstance(search_results, dict):
            web_results = search_results.get('data', []) or search_results.get('web', [])

        if web_results:
            for item in web_results:
                url = getattr(item, 'url', None) or (item.get('url', '') if isinstance(item, dict) else '')
            
                if url:
                    url_clean = str(url).split('?')[0]
                    url_lower = str(url).lower()

                    if "/in/" in url_lower and "linkedin.com" in url_lower:
                        if not any(x in url_lower for x in ["/posts/", "/events/", "/jobs/", "/pulse/", "/dir/"]):
                            links.append(url_clean)
        
        unique_links = list(set(links))
        print(f"Encontrados {len(unique_links)} enlaces validos")
        return unique_links

    except Exception as e:
        print(f"Error en la busqueda de Firecrawl: {e}")
        return[]

async def extract_linked(sectors: dict, locations: list, headless: bool) -> List[Dict[str, Any]]:
# Función principal llamada por el orquestador
    print("Iniciando módulo de extracción de candidatos de LinkedIn")
    extracted_candidates = []

    for loc in locations:
        for sector_name, term in sectors.items():

            sector_keywords = KEYWORDS_PER_SECTOR.get(sector_name, [])
            print(f"Buscando sector '{sector_name}' en '{loc}'")

            urls = await search_profiles(term, loc, keywords=sector_keywords)

            if not urls:
                print(f"No se encontraron URLs para {sector_name}")
                continue

            for url in urls:
                candidate_data = await extract_with_agent(url, loc, headless)

                if candidate_data: print(f"Exito: {candidate_data('first_name')} extraido")
                extracted_candidates.append(candidate_data)

        print(f"LinkedIn terminado {len(extracted_candidates)} candidatos listo para la validación")

        return extracted_candidates


# Test rápido
if __name__ == "__main__":
    asyncio.run(search_profiles("Python Developer", "Madrid"))