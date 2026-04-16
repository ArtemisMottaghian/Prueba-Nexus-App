import asyncio
import aiohttp
import urllib.parse
import re
import os
from dotenv import load_dotenv

# IMPORTACIONES DE TU PROYECTO
from app.db.session import AsyncSessionLocal
from .utils import upsert_scraped_candidate
from backend.app.core.scraper_candidates_github_config import LENGUAJES_IT, LOCATIONS_GITHUB
from .browser import search_linkedin_with_browser


# CONFIGURACIÓN INICIAL

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"token {GITHUB_TOKEN}" if GITHUB_TOKEN else "",
    "X-GitHub-Api-Version": "2022-11-28"
}

MAX_CANDIDATES = 20


# FUNCIONES DE VALIDACIÓN Y LIMPIEZA

def is_valid_portfolio(url: str) -> bool:
    if not url or not url.startswith("http"): return False
    blacklist_domains = [
        "bitcoin.org", "python.org", "youtube.com", "twitter.com", "x.com", 
        "facebook.com", "instagram.com", "t.me", "reddit.com", "wikipedia.org",
        "google.com", "apple.com", "microsoft.com", "amazon.com", "reactjs.org"
    ]
    url_lower = url.lower()
    for domain in blacklist_domains:
        if domain in url_lower:
            return False
    return True

def is_human_name(name: str) -> bool:
    if not name: return False
    return bool(re.match(r'^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s-]+$', name))

def extract_name_from_linkedin(linkedin_url: str):
    if not linkedin_url: return None, None
    match = re.search(r'linkedin\.com/in/([^/]+)', linkedin_url, re.IGNORECASE)
    if match:
        slug = match.group(1)
        slug_clean = re.sub(r'-[a-z0-9A-Z]{5,}$', '', slug)
        slug_clean = re.sub(r'\d+$', '', slug_clean)
        parts = slug_clean.replace('-', ' ').split()
        if len(parts) >= 2:
            return parts[0].capitalize(), " ".join(parts[1:]).title()
    return None, None


# 1. ESCÁNER DE PORTFOLIOS Y READMES

async def extract_linkedin_from_portfolio(url: str) -> str | None:
    if not url or not url.startswith("http"): return None
    headers_web = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers_web, timeout=6, ssl=False) as resp:
                if resp.status == 200:
                    html = await resp.text()
                    match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', html, re.IGNORECASE)
                    if match: return match.group(1)
    except Exception: pass
    return None

async def extract_linkedin_from_readme(username: str) -> str | None:
    branches = ['main', 'master']
    async with aiohttp.ClientSession() as session:
        for branch in branches:
            url = f"https://raw.githubusercontent.com/{username}/{username}/{branch}/README.md"
            try:
                async with session.get(url, timeout=5) as resp:
                    if resp.status == 200:
                        text = await resp.text()
                        match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', text, re.IGNORECASE)
                        if match: return match.group(1)
            except Exception: pass
    return None


# 2. EXTRACCIÓN DE DATOS DE LA API DE GITHUB

async def get_user_skills(session: aiohttp.ClientSession, repos_url: str) -> str:
    try:
        async with session.get(f"{repos_url}?sort=updated&per_page=10", headers=HEADERS) as resp:
            if resp.status == 200:
                repos = await resp.json()
                languages = {repo["language"] for repo in repos if repo.get("language")}
                return " | ".join(list(languages)) if languages else "Desarrollo de Software"
    except Exception: pass
    return "Desarrollo de Software"

async def extract_github_profile(session: aiohttp.ClientSession, username: str) -> dict | None:
    url = f"https://api.github.com/users/{username}"
    try:
        async with session.get(url, headers=HEADERS) as resp:
            if resp.status != 200: return None
            user_data = await resp.json()
            
            if user_data.get("type") != "User": return None

            raw_name = user_data.get("name")
            github_url = user_data.get("html_url")
            blog = user_data.get("blog", "")
            location = user_data.get("location") or "España"
            
            linkedin_url = None
            portfolio_url = None
            
            if blog:
                if "linkedin.com" in blog.lower():
                    linkedin_url = blog if blog.startswith("http") else f"https://{blog}"
                elif is_valid_portfolio(blog):
                    portfolio_url = blog if blog.startswith("http") else f"https://{blog}"
                    linkedin_url = await extract_linkedin_from_portfolio(portfolio_url)
            
            if not linkedin_url:
                linkedin_url = await extract_linkedin_from_readme(username)
                
            first_name = None
            last_name = None
            
            if raw_name and len(raw_name.split()) >= 2 and is_human_name(raw_name):
                parts = raw_name.split()
                first_name = parts[0].capitalize()
                last_name = " ".join(parts[1:]).title()
            else:
                if not linkedin_url and raw_name:
                    print(f"      -> Nombre sospechoso, intentando buscar LinkedIn para: {raw_name}...")
                    linkedin_url = await search_linkedin_with_browser(raw_name, "")
                
                if linkedin_url:
                    first_name, last_name = extract_name_from_linkedin(linkedin_url)
            
            if not first_name or not last_name: return None

            full_name_check = f"{first_name} {last_name}".lower()
            blacklist = ["university", "universitat", "group", "lab", "technology", "dept", "official", "team", "studio", "españa", "asociación", "association"]
            if any(word in full_name_check for word in blacklist): return None

            if not linkedin_url:
                print(f"      -> Buscando LinkedIn en la web para: {first_name} {last_name}...")
                linkedin_url = await search_linkedin_with_browser(first_name, last_name)
            
            contact_urls = []
            if linkedin_url: contact_urls.append(linkedin_url)
            if portfolio_url: contact_urls.append(portfolio_url)
            final_urls_string = " | ".join(contact_urls) if contact_urls else None
            
            skills = await get_user_skills(session, user_data.get("repos_url"))

            return {
                "first_name": first_name,
                "last_name": last_name,
                "email": user_data.get("email") or f"{username.lower()}@scraping.local",
                "phone": None,
                "location": location,
                "source": "GitHub API",
                "experience": user_data.get("bio") or f"Desarrollador en GitHub",
                "candidate_url": final_urls_string,
                "cv_url": github_url,
                "skills": skills,
                "status": "active"
            }
    except Exception as e: 
        print(f"Error extrayendo {username}: {e}")
        return None


# 4. MOTOR PRINCIPAL

async def run_github_scraper():
    print(f"\n--- SCRAPER DE GITHUB: MÁXIMO {MAX_CANDIDATES} CANDIDATOS EFECTIVOS ---")
    
    if not GITHUB_TOKEN:
        print(" AVISO: No hay GITHUB_TOKEN. Límite muy estricto de peticiones (60/hora).")

    scraped_count = 0

    async with aiohttp.ClientSession() as session:
        async with AsyncSessionLocal() as db:
            for lang in LENGUAJES_IT:
                if scraped_count >= MAX_CANDIDATES: break 
                
                for loc in LOCATIONS_GITHUB:
                    if scraped_count >= MAX_CANDIDATES: break 
                    
                    query = f"language:{lang} location:{loc}"
                    print(f"\nBuscando {lang} en {loc}...")
                    
                    search_url = f"https://api.github.com/search/users?q={urllib.parse.quote_plus(query)}&per_page=30"
                    
                    try:
                        async with session.get(search_url, headers=HEADERS) as resp:
                            if resp.status == 403:
                                print(" Límite de API de GitHub alcanzado. Pausando búsqueda.")
                                return
                            elif resp.status == 200:
                                data = await resp.json()
                                items = data.get("items", [])
                                
                                if not items: continue
                                
                                for item in items:
                                    if scraped_count >= MAX_CANDIDATES:
                                        print(f"\n ¡Límite de {MAX_CANDIDATES} candidatos efectivos alcanzado! Finalizando con éxito.")
                                        return
                                        
                                    candidate = await extract_github_profile(session, item["login"])
                                    
                                    if candidate:
                                        try:
                                            # LA MAGIA OCURRE AQUÍ
                                            # Guardamos el resultado en la variable 'hubo_cambios'
                                            hubo_cambios = await upsert_scraped_candidate(db, candidate)
                                            
                                            # Solo sumamos al contador si hubo_cambios es True
                                            if hubo_cambios:
                                                scraped_count += 1
                                                print(f"  [{scraped_count}/{MAX_CANDIDATES}] Guardado/Actualizado: {candidate['first_name']} {candidate['last_name']}")
                                            else:
                                                print(f"  Omitido (Ya existe sin cambios): {candidate['first_name']} {candidate['last_name']}")
                                                
                                        except Exception as e:
                                            print(f" Error al guardar en BD: {e}")
                                            
                                    await asyncio.sleep(1)
                    except Exception as e:
                        print(f" Error en la búsqueda principal: {e}")

if __name__ == "__main__":
    asyncio.run(run_github_scraper())