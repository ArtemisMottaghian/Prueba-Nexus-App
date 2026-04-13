import asyncio
import aiohttp
import urllib.parse
import re
import os
import random
from dotenv import load_dotenv
from app.db.session import AsyncSessionLocal

# Usamos la ruta absoluta a tu repositorio original
from app.services.scrapers.scraper_pdf_google.scraper_repository import upsert_scraped_candidate
from app.core.scraper_github_config import LENGUAJES_IT, LOCATIONS_GITHUB

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"token {GITHUB_TOKEN}" if GITHUB_TOKEN else "",
    "X-GitHub-Api-Version": "2022-11-28"
}


# 1. ESCÁNER DE PORTFOLIOS Y READMES

async def extract_linkedin_from_portfolio(url: str) -> str:
    if not url.startswith("http"): return None
    headers_web = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers_web, timeout=6, ssl=False) as resp:
                if resp.status == 200:
                    html = await resp.text()
                    match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_/%-]+)', html, re.IGNORECASE)
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
                        match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_/%-]+)', text, re.IGNORECASE)
                        if match: return match.group(1)
            except Exception: pass
    return None


# 2. EL "DETECTIVE" DE LINKEDIN

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

async def search_external_profile(first_name: str, last_name: str, username: str, location: str) -> str:
    if not first_name or first_name.lower() == "github" or len(first_name) < 2: return None

    async def do_search(query: str) -> str:
        headers_web = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9"
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"https://es.search.yahoo.com/search?p={query}", headers=headers_web, timeout=6) as resp:
                    if resp.status == 200:
                        decoded = urllib.parse.unquote(await resp.text())
                        match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_/%-]+)', decoded, re.IGNORECASE)
                        if match: return match.group(1)
        except Exception: pass

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"https://html.duckduckgo.com/html/?q={query}", headers=headers_web, timeout=6) as resp:
                    if resp.status == 200:
                        decoded = urllib.parse.unquote(await resp.text())
                        match = re.search(r'(https?://(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_/%-]+)', decoded, re.IGNORECASE)
                        if match: return match.group(1)
        except Exception: pass
        return None

    # Intento 1: Máxima precisión (Nombre + Nickname + Ciudad)
    res_1 = await do_search(urllib.parse.quote_plus(f'"{first_name} {last_name}" {username} {location} site:linkedin.com/in/'))
    if res_1: return res_1

    # Intento 2: Solo Nombre y Ciudad (Por si el nickname es distinto)
    res_2 = await do_search(urllib.parse.quote_plus(f'"{first_name} {last_name}" {location} site:linkedin.com/in/'))
    if res_2: return res_2
    
    # Intento 3: LA BARREDORA (El método de la V1 que funcionaba con Noah Gift)
    # Sin ciudad, sin nickname. Solo el nombre pelado y duro.
    return await do_search(urllib.parse.quote_plus(f'"{first_name} {last_name}" site:linkedin.com/in/'))


# 3. EXTRACCIÓN DE DATOS DE LA API DE GITHUB

async def get_user_skills(session: aiohttp.ClientSession, repos_url: str) -> str:
    try:
        async with session.get(f"{repos_url}?sort=updated&per_page=10", headers=HEADERS) as resp:
            if resp.status == 200:
                repos = await resp.json()
                languages = set()
                for repo in repos:
                    if repo.get("language"):
                        languages.add(repo["language"])
                if languages:
                    return " | ".join(list(languages))
    except Exception: pass
    return "Desarrollo de Software"

async def extract_github_profile(session: aiohttp.ClientSession, username: str) -> dict:
    url = f"https://api.github.com/users/{username}"
    
    try:
        async with session.get(url, headers=HEADERS) as resp:
            if resp.status != 200: return None
            
            user_data = await resp.json()
            full_name = user_data.get("name")
            if not full_name or len(full_name.split()) < 2:
                print(f"      -> Descartado: '{username}' no tiene configurado un nombre real público.")
                return None
                
            parts = full_name.split()
            first_name = parts[0].capitalize()
            last_name = " ".join(parts[1:]).title()
            
            if first_name.lower() in ["the", "admin", "team", "project", "dev", "developer", "studio", "hola"]:
                print(f"      -> Descartado: '{username}' parece cuenta de empresa.")
                return None
                
            email = user_data.get("email") or f"{username.lower()}@github.local"
            location = user_data.get("location") or "España"
            
            bio = user_data.get("bio")
            company = user_data.get("company")
            experience_parts = []
            if company: experience_parts.append(f"Empresa: {company}")
            if bio: experience_parts.append(bio)
            clean_exp = " | ".join(experience_parts) if experience_parts else None
            
            github_url = user_data.get("html_url")
            blog = user_data.get("blog", "")
            linkedin_url = None
            portfolio_url = None
            
            # --- CASCADA DE BÚSQUEDA ---
            if blog:
                if "linkedin.com/in/" in blog.lower():
                    linkedin_url = blog if blog.startswith("http") else f"https://{blog}"
                else:
                    portfolio_url = blog if blog.startswith("http") else f"https://{blog}"
                    linkedin_url = await extract_linkedin_from_portfolio(portfolio_url)
            
            if not linkedin_url:
                linkedin_url = await extract_linkedin_from_readme(username)
                
            if not linkedin_url:
                linkedin_url = await search_external_profile(first_name, last_name, username, location)
                
            skills = await get_user_skills(session, user_data.get("repos_url"))

            candidate_urls_list = []
            if linkedin_url: candidate_urls_list.append(linkedin_url)
            if portfolio_url: candidate_urls_list.append(portfolio_url)
                
            final_candidate_url = " | ".join(candidate_urls_list)[:255] if candidate_urls_list else None

            return {
                "first_name": first_name[:100],
                "last_name": last_name[:100],
                "email": email[:255],
                "phone": None,
                "location": location[:100],
                "source": "GitHub API",
                "experience": clean_exp, 
                "candidate_url": final_candidate_url, 
                "cv_url": github_url, 
                "skills": skills, 
                "status": "active",
                "notes": None
            }
            
    except Exception as e:
        print(f"   -> Error extrayendo perfil {username}: {e}")
        return None


# 4. MOTOR PRINCIPAL DE BÚSQUEDA

async def run_github_scraper():
    print("Iniciando búsqueda en GitHub API...")
    if not GITHUB_TOKEN:
        print("¡AVISO CRÍTICO! No se encontró GITHUB_TOKEN en el archivo .env. Límite de 60 peticiones/hora.")

    search_queries = []
    for lang in LENGUAJES_IT:
        for loc in LOCATIONS_GITHUB:
            search_queries.append(f"language:{lang} location:{loc}")
    
    async with aiohttp.ClientSession() as session:
        async with AsyncSessionLocal() as db:
            for query in search_queries:
                print(f"\n--- Buscando perfiles IT: '{query}' ---")
                
                search_url = f"https://api.github.com/search/users?q={urllib.parse.quote_plus(query)}&per_page=15"
                
                try:
                    async with session.get(search_url, headers=HEADERS) as resp:
                        if resp.status == 403:
                            print("Límite API de GitHub alcanzado. Espera un poco o revisa tu Token.")
                            break
                            
                        data = await resp.json()
                        users = data.get("items", [])
                        
                        if not users:
                            continue
                            
                        print(f"Encontrados {len(users)} desarrolladores. Procesando...")
                        
                        for user in users:
                            username = user["login"]
                            print(f"-> Analizando a: {username}")
                            
                            candidate_data = await extract_github_profile(session, username)
                            
                            if candidate_data:
                                success = await upsert_scraped_candidate(db, candidate_data)
                                if success:
                                    linkedin_status = "[LinkedIn Cazado]" if "linkedin.com" in (candidate_data.get('candidate_url') or "") else ""
                                    portfolio_status = "[Portfolio]" if " | " in (candidate_data.get('candidate_url') or "") or (candidate_data.get('candidate_url') and "linkedin.com" not in candidate_data.get('candidate_url')) else ""
                                    
                                    print(f"    Guardado en BD: {candidate_data['first_name']} {candidate_data['last_name']} {linkedin_status} {portfolio_status}")
                                    
                            await asyncio.sleep(1.5) 
                            
                except Exception as e:
                    print(f"Error en la búsqueda principal: {e}")

if __name__ == "__main__":
    asyncio.run(run_github_scraper())