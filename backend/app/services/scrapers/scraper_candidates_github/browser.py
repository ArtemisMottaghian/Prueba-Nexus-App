import urllib.parse
import re
import aiohttp
import asyncio
import random

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

async def search_linkedin_with_browser(first_name: str, last_name: str) -> str | None:
    """
    Busca el LinkedIn del candidato usando DuckDuckGo via HTTP directo (sin browser).
    Si no hay conexión o DuckDuckGo bloquea, retorna None sin colgarse.
    """
    if not first_name or not last_name:
        return None

    pause = random.uniform(2, 5)
    await asyncio.sleep(pause)
    
    query = urllib.parse.quote_plus(f'"{first_name} {last_name}" España site:linkedin.com/in/')
    url = f"https://www.bing.com/search?q={query}"

    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "es-ES,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 200:
                    html = urllib.parse.unquote(await resp.text())
                    match = re.search(
                        r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[a-zA-Z0-9%_.-]+)',
                        html, re.IGNORECASE
                    )
                    if match:
                        print(f"      -> LinkedIn encontrado para {first_name}: {match.group(1)}")
                        return match.group(1)
                    else:
                        print(f"      -> El buscador no devolvió perfil para {first_name}")
                else:
                    print(f"      -> El buscador bloqueó la búsqueda (Error {resp.status})")
    except Exception as e:
        print(f"      -> Sin conexión o timeout buscando LinkedIn para {first_name}: {e}")

    return None