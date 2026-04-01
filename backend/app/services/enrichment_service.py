import httpx
import asyncio
from app.core.config import settings

#busqueda en dropcontact
async def search_in_dropcontact(name: str, company: str) -> str | None:
    url = "https://api.dropcontact.io/batch"
    headers = {"X-Access-Token": settings.DROPCONTACT_API_KEY, "Content-Type": "application/json"}
    payload = {"data": [{"full_name": name, "company": company}]}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                if data and data[0].get("email"):
                    emails = data[0]["email"]
                    return emails[0]["email"] if isinstance(emails, list) else emails
    except Exception as e:
        print(f"⚠️ Error Dropcontact: {e}")
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