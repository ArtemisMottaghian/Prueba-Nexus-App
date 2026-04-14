import asyncio
import aiohttp
import urllib.parse
import re
import os
import random
from dotenv import load_dotenv

# IMPORTACIONES DE TU PROYECTO
from app.db.session import AsyncSessionLocal
from app.services.scrapers.scraper_pdf_google.scraper_repository import upsert_scraped_candidate
from app.core.scraper_github_config import LENGUAJES_IT, LOCATIONS_GITHUB

# ==============================================================================
# CONFIGURACIÓN INICIAL
# ==============================================================================
load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"token {GITHUB_TOKEN}" if GITHUB_TOKEN else "",
    "X-GitHub-Api-Version": "2022-11-28"
}

# ==============================================================================
# 1. ESCÁNER DE PORTFOLIOS Y READMES
# ==============================================================================
async def extract_linkedin_from_portfolio(url: str) -> str:
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

async def extract_linkedin_from_readme(username: str) -> str:
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

# ==============================================================================
# 2. EL DETECTIVE DE LINKEDIN (Francotirador)
# ==============================================================================
async def search_external_profile(first_name: str, last_name: str) -> str:
    if not first_name or len(first_name) < 2: return None
    
    query = urllib.parse.quote_plus(f'{first_name} {last_name} España site:linkedin.com/in/')
    url = f"https://es.search.yahoo.com/search?p={query}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=6) as resp:
                if resp.status == 200:
                    html = urllib.parse.unquote(await resp.text())
                    match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', html, re.IGNORECASE)
                    if match: return match.group(1)
    except Exception: pass
    return None

# ==============================================================================
# 3. EXTRACCIÓN DE DATOS DE LA API DE GITHUB Y FILTROS
# ==============================================================================
async def get_user_skills(session: aiohttp.ClientSession, repos_url: str) -> str:
    try:
        async with session.get(f"{repos_url}?sort=updated&per_page=10", headers=HEADERS) as resp:
            if resp.status == 200:
                repos = await resp.json()
                languages = {repo["language"] for repo in repos if repo.get("language")}
                return " | ".join(list(languages)) if languages else "Desarrollo de Software"
    except Exception: pass
    return "Desarrollo de Software"

async def extract_github_profile(session: aiohttp.ClientSession, username: str) -> dict:
    url = f"https://api.github.com/users/{username}"
    try:
        async with session.get(url, headers=HEADERS) as resp:
            if resp.status != 200: return None
            
            user_data = await resp.json()
            full_name = user_data.get("name")
            
            # --- FILTRO HUMANO 2.0 ---
            # 1. Debe tener nombre compuesto (Nombre y Apellido)
            if not full_name or len(full_name.split()) < 2:
                return None
            
            # 2. Lista negra de palabras institucionales (Para evitar casos como Universitat Pompeu Fabra)
            blacklist = ["university", "universitat", "group", "lab", "technology", "dept", "department", "official", "team", "studio"]
            if any(word in full_name.lower() for word in blacklist):
                print(f"      -> Saltando institucional: {full_name}")
                return None

            parts = full_name.split()
            first_name = parts[0].capitalize()
            last_name = " ".join(parts[1:]).title()
            
            github_url = user_data.get("html_url")
            blog = user_data.get("blog", "")
            location = user_data.get("location") or "España"
            
            # --- MULTI-LINK (Aspirador de URLs) ---
            urls_encontradas = [github_url]
            linkedin_url = None
            portfolio_url = None
            
            if blog:
                if "linkedin.com" in blog.lower():
                    linkedin_url = blog if blog.startswith("http") else f"https://{blog}"
                else:
                    portfolio_url = blog if blog.startswith("http") else f"https://{blog}"
                    linkedin_url = await extract_linkedin_from_portfolio(portfolio_url)
            
            if not linkedin_url:
                linkedin_url = await extract_linkedin_from_readme(username)
                
            if not linkedin_url:
                linkedin_url = await search_external_profile(first_name, last_name)
            
            # Añadimos a la lista si existen y no están repetidas
            if linkedin_url and linkedin_url not in urls_encontradas: 
                urls_encontradas.append(linkedin_url)
            if portfolio_url and portfolio_url not in urls_encontradas: 
                urls_encontradas.append(portfolio_url)

            # Unimos sin cortar a 255 caracteres
            final_urls_string = " | ".join(urls_encontradas)
            
            skills = await get_user_skills(session, user_data.get("repos_url"))

            return {
                "first_name": first_name,
                "last_name": last_name,
                "email": user_data.get("email") or f"{username.lower()}@github.local",
                "phone": None,
                "location": location,
                "source": "GitHub API",
                "experience": user_data.get("bio") or f"Desarrollador en GitHub",
                "candidate_url": final_urls_string, # TODAS LAS URLS JUNTAS
                "cv_url": github_url,
                "skills": skills,
                "status": "active"
            }
    except Exception as e: 
        print(f"Error extrayendo {username}: {e}")
        return None

# ==============================================================================
# 4. MOTOR PRINCIPAL
# ==============================================================================
async def run_github_scraper():
    print("\n---  SCRAPER DE GITHUB: MODO HUMANO Y MULTI-ENLACE ---")
    
    if not GITHUB_TOKEN:
        print("⚠️ AVISO: No hay GITHUB_TOKEN. Límite muy estricto de peticiones (60/hora).")

    async with aiohttp.ClientSession() as session:
        async with AsyncSessionLocal() as db:
            for lang in LENGUAJES_IT:
                for loc in LOCATIONS_GITHUB:
                    query = f"language:{lang} location:{loc}"
                    print(f"\n Buscando {lang} en {loc}...")
                    
                    search_url = f"https://api.github.com/search/users?q={urllib.parse.quote_plus(query)}&per_page=15"
                    
                    try:
                        async with session.get(search_url, headers=HEADERS) as resp:
                            if resp.status == 403:
                                print(" Límite de API de GitHub alcanzado. Pausando búsqueda.")
                                return
                            elif resp.status == 200:
                                data = await resp.json()
                                items = data.get("items", [])
                                
                                if not items: continue
                                print(f"Encontrados {len(items)} perfiles. Filtrando humanos...")
                                
                                for item in items:
                                    candidate = await extract_github_profile(session, item["login"])
                                    
                                    if candidate:
                                        try:
                                            await upsert_scraped_candidate(db, candidate)
                                            # Pequeño feedback visual
                                            links_count = len(candidate['candidate_url'].split(' | '))
                                            print(f" Guardado: {candidate['first_name']} {candidate['last_name']} [{links_count} enlaces]")
                                        except Exception as e:
                                            print(f"⚠️ Error al guardar en BD: {e}")
                                            
                                    await asyncio.sleep(1.5) # Respeto a los servidores
                    except Exception as e:
                        print(f" Error en la búsqueda principal: {e}")

if __name__ == "__main__":
    asyncio.run(run_github_scraper())