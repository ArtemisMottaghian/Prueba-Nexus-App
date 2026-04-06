import asyncio
import httpx
from app.core.config import settings

async def extract_adzuna() -> list[dict]:

    url = f"https://api.adzuna.com/v1/api/jobs/{settings.ADZUNA_PAIS}/search/1"
    # En esta lista se recogen las categorias de los trabajos que queremos buscar
    # Se puede añadir las que se quieran y Adzuna devolvera una respuesta por cada una de ellas
    search_categories = ["it-jobs", "engineering-jobs"]

    raw_leads = []
    ids_watched = set()
    urls_watched = set()

    async with httpx.AsyncClient() as client:
        for category in search_categories:
            params = {
                "app_id": settings.ADZUNA_APP_ID,
                "app_key": settings.ADZUNA_APP_KEY,
                "results_per_page": 5,
                "category": category,
            }

            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                print(f"Error al conectar con Adzuna: {str(e)}")
                continue

            for job in data.get("results", []):
                external_id = str(job.get("id"))
                url_text = str(job.get("redirect_url"))

                if external_id in ids_watched or url_text in urls_watched:
                    continue

                job_title = job.get("title", "")
                job_description = job.get("description", "")
                job_ubication = job.get("ubication", "")
                lead_description = f"{job_title} {job_description} {job_ubication}".lower()
                work_modality = None

                if any(modality in lead_description for modality in ["híbrid", "hibrid", "hybrid"]):
                    work_modality = "Híbrido"
                elif any(modality in lead_description for modality in ["remoto", "teletrabajo", "100% remote", "fully remote"]):
                    work_modality = "Remoto"
                elif any(modality in lead_description for modality in ["presencial", "on-site", "onsite", "en oficina", "in office"]):
                    work_modality = "Presencial"

                raw_lead = {
                    "portal_id": 1,
                    "external_id": external_id,
                    "title": job.get("title", "Sin título"),
                    "company_name": job.get("company", {}).get(
                        "display_name", "Empresa Oculta"),
                    'location': job.get("location", {}).get(
                        "display_name", "Sin ubicación"
                    ),
                    "offer_url": url_text,
                    "job_description": job.get("description"),
                    "published_at": job.get("created"),
                    "sector": job.get("category", {}).get("label"),
                    "salary_min": job.get("salary_min"),
                    "salary_max": job.get("salary_max"),
                    "work_modality": work_modality,
                    "contract_type": job.get("contract_type"),
                    "contract_time": job.get("contract_time"),

                    "recruiter_name": None,
                    "recruiter_email": None
                }

                raw_leads.append(raw_lead)
                ids_watched.add(external_id)
                urls_watched.add(url_text)

                url_text = str(job.get("redirect_url"))

    return raw_leads

if __name__ == "__main__":
    resultados = asyncio.run(extract_adzuna())
    print(f"Se han extraido {len(resultados)} ofertas de Adzuna.")
