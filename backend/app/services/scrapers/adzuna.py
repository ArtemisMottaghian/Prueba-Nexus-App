import asyncio
import httpx
from app.core.config import settings
from app.services.scraper_logs_service import log_scraper_error

# En esta lista se recogen las categorias de los trabajos que queremos buscar
# Se puede añadir las que se quieran y Adzuna devolvera una respuesta por cada una de ellas
DEFAULT_CATEGORIES = [
"it-jobs",
"engineering-jobs",
"sales-jobs",
"legal-jobs",
"hr-jobs",
]

def determine_work_modality(title:str, description: str, location: str) -> str | None:
    """
    Infiere la modalidad de trabajo buscando palabras clave en los textos descriptivos.

    Args:
        title (str): Título de la oferta.
        description (str): Descripción de la oferta.
        location (str): Nombre de la ubicación.
        
    Returns:
        str | None: "Híbrido", "Remoto", "Presencial", o None si no se puede determinar.
    """

    text_to_search = f"{title} {description} {location}".lower()

    if any(mod in text_to_search for mod in ["híbrid", "hibrid", "hybrid"]):
        return "Híbrido"
    elif any(mod in text_to_search for mod in ["remoto", "remote", "teletrabajo", "100% remoto", "fully remote"]):
        return "Remoto"
    elif any(mod in text_to_search for mod in ["presencial", "on-site", "onsite", "en oficina", "in office"]):
        return "Presencial"
    
    return None

def parse_job_data(job: dict) -> dict:
    """
    Parsea los datos crudos de Adzuna al formato estandarizado de nuestro CRM (raw_lead).
    
    Args:
        job (dict): Diccionario crudo devuelto por la API de Adzuna.
        
    Returns:
        dict: Diccionario mapeado con los campos requeridos por la base de datos.
    """

    title = job.get("title", "")
    description = job.get("description", "")
    location_name = job.get("location", {}).get("display_name", "")

    modality = determine_work_modality(title, description, location_name)

    return {
        "portal_id": 1,
        "external_id": str(job.get("id")),
        "title": title or "Sin título",
        "company_name": job.get("company", {}).get("display_name", "Empresa Oculta"),
        "location": location_name or "Sin ubicación",
        "offer_url": str(job.get("redirect_url", "")),
        "job_description": description,
        "published_at": job.get("created"),
        "sector": job.get("category", {}).get("label"),
        "salary_min": job.get("salary_min"),
        "salary_max": job.get("salary_max"),
        "work_modality": modality,
        "contract_type": job.get("contract_type"),
        "contract_time": job.get("contract_time"),
        "recruiter_name": None,
        "recruiter_email": None
    }

async def fetch_category_jobs(client: httpx.AsyncClient, category: str) -> list[dict]:
    """
    Realiza la petición HTTP a la API de Adzuna para una categoría específica.
    
    Args:
        client (httpx.AsyncClient): Sesión asíncrona de HTTPX.
        category (str): Categoría a buscar (ej. "it-jobs").
        
    Returns:
        list[dict]: Lista de ofertas de trabajo en bruto. Devuelve una lista vacía si hay error.
    """
    url = f"https://api.adzuna.com/v1/api/jobs/{settings.ADZUNA_PAIS}/search/1"
    params = {
        "app_id": settings.ADZUNA_APP_ID,
        "app_key": settings.ADZUNA_APP_KEY,
        "results_per_page": 50,
        "category": category,
    }

    try:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])
    except Exception as e:
        await log_scraper_error(
            error_code="SCRAPER_ADZUNA_HTTP",
            message=f"scraper=adzuna | stage=request | category={category} | exc={e}"
        )
        print(f"Error al conectar con Adzuna en categoría '{category}': {str(e)}")
        return []


async def extract_adzuna(categories: list[str] = None) -> list[dict]:
    """
    Orquesta el proceso de extracción de datos de la API de Adzuna, manejando
    la deduplicación y el mapeo de los datos.

    Args:
        categories (list[str], optional): Lista de categorías a extraer.
                                          Si no se provee, usa DEFAULT_CATEGORIES.

    Returns:
        list[dict]: Lista de leads estandarizados y sin duplicados.
    """
    search_categories = categories or DEFAULT_CATEGORIES
    raw_leads = []
    ids_watched = set()
    urls_watched = set()

    async with httpx.AsyncClient() as client:
        for category in search_categories:
            jobs = await fetch_category_jobs(client, category)

            for job in jobs:
                try:
                    external_id = str(job.get("id"))
                    url_text = str(job.get("redirect_url"))

                    if external_id in ids_watched or url_text in urls_watched:
                        continue

                    parsed_lead = parse_job_data(job)
                    raw_leads.append(parsed_lead)

                    ids_watched.add(external_id)
                    urls_watched.add(url_text)

                except Exception as e:
                    await log_scraper_error(
                        error_code="SCRAPER_ADZUNA_PARSE",
                        message=f"scraper=adzuna | stage=parse | external_id={job.get('id', 'N/A')} | exc={e}",
                    )
                    continue

    return raw_leads

# if __name__ == "__main__":
#     resultados = asyncio.run(extract_adzuna())
#     print(f"Se han extraido {len(resultados)} ofertas de Adzuna.")
#     for resultado in resultados:
#         print(resultado)

