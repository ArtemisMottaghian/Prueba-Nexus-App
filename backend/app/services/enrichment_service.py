import httpx
import asyncio
from typing import Optional
from app.core.config import settings

async def enrich_company(company_name: str, raw_text: str = "") -> dict:
    """
    Usa la lógica de scraper_companies.py para investigar la empresa.
    """
    try:
        from app.services.scrapers.scraper_companies.scraper_companies import extract_company_data
        
        print(f"   -> [MOTOR] Investigando {company_name} en un hilo separado")
        # Ejecutamos la función original (es síncrona, así que no lleva await)
        data = await asyncio.to_thread(extract_company_data, raw_text, company_name)
        return data
    except Exception as e:
        print(f"[Error] No se pudo importar o ejecutar extract_company_data: {e}")
        return {"name": company_name, 
            "sector": None, 
            "cif": None, 
            "website": None, 
            "address": None,
            "linkedin_url": None}
        
#busqueda en dropcontact
async def search_in_dropcontact(first_name: str, last_name:str, company: str, website: Optional[str]) -> dict | None:
    url = "https://api.dropcontact.io/v1/enrich/all"
    headers = {"X-Access-Token": settings.DROPCONTACT_API_KEY, "Content-Type": "application/json"}
    payload= {
        "data": [{
            "firstName": first_name,
            "lastName": last_name,
            "company": company,
            "website": website
        }],
        "siren": True #Util para obtener datos legales si la empresa es francesa
    }

    try:
        resp = await httpx.AsyncClient(timeout=30.0).post(url, json=payload, headers=headers)
        resp.raise_for_status() # Lanza una excepcion si hay errores

        result = resp.json()
        
        # IMPORTANTE: Dropcontact suele devolver {"success": True, "request_id": "..."}
        # El email no suele venir en la primera llamada
        if result.get("success"):
            return result
        
    except httpx.HTTPStatusError as e:
        print(f"Error Dropcontact: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        print(f"Error Dropcontact: {e}")
    return None

#reclutador en phantom
async def search_with_phantombuster(company_name: str) -> dict | None:
    headers = {"X-Phantombuster-Key": settings.PHANTOMBUSTER_API_KEY, "Content-Type": "application/json"}
    
    launch_url = "https://api.phantombuster.com/api/v2/agents/launch"
    search_query = f'"Human Resources" OR "HR" OR "Recruiter" OR "Talent" AND "{company_name}"'

    payload = {
        "id": settings.PB_LINKEDIN_SEARCH_ID, 
        "argument": {
            "sessionCookie": settings.LINKEDIN_SESSION_COOKIE,
            "search": search_query, 
            "numberOfResultsPerSearch": 3, # limitacion po ris acaso
            "userAgent": settings.LINKEDIN_USER_AGENT
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            launch_resp = await client.post(launch_url, json=payload, headers=headers)
            if launch_resp.status_code != 200: return None
            
            # Consultamos cada 20 segundos
            output_url = f"https://api.phantombuster.com/api/v2/agents/fetch-output?id={settings.PB_LINKEDIN_SEARCH_ID}"
            for _ in range(5):
                await asyncio.sleep(20)
                res = await client.get(output_url, headers=headers)
                if res.status_code == 200:
                    result_data = res.json()
                    if result_data.get("resultObject"):
                        import json
                        profiles = json.loads(result_data["resultObject"])
                        if profiles:
                            p = profiles[0]
                            return {
                                "nombre": p.get("firstName"),
                                "apellidos": p.get("lastName"),
                                "linkedin": p.get("profileUrl")
                            }
    except Exception as e:
        print(f"Error PhantomBuster: {e}")
    return None