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
        data = await asyncio.to_thread(extract_company_data, raw_text, company_name)
        return data
    except Exception as e:
        print(f"[Error] No se pudo importar o ejecutar extract_company_data: {e}")
        return {
            "name": company_name,
            "sector": None,
            "cif": None,
            "website": None,
            "address": None,
            "linkedin_url": None
        }


async def enrich_person_with_apollo(first_name: str, last_name: str, company: str, website: Optional[str] = None) -> dict | None:
    """
    Encuentra datos adicionales (email y teléfono) de una persona concreta
    usando el endpoint de Match de Apollo.
    """
    url = "https://api.apollo.io/api/v1/people/match"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json"
    }
    payload = {
        "api_key": settings.APOLLO_API_KEY,
        "first_name": first_name,
        "last_name": last_name,
        "organization_name": company
    }
    if website:
        payload["domain"] = website

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()

            if result.get("person"):
                p = result["person"]
                telefonos = p.get("phone_numbers", [])
                telefono_principal = telefonos[0].get("sanitized_number") if telefonos else None
                return {
                    "nombre": p.get("first_name"),
                    "apellidos": p.get("last_name"),
                    "linkedin": p.get("linkedin_url"),
                    "email": p.get("email"),
                    "titulo": p.get("title"),
                    "telefono": telefono_principal
                }

    except httpx.HTTPStatusError as e:
        print(f"Error Apollo Match HTTP: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        print(f"Error Apollo Match: {e}")

    return None


async def search_recruiter_with_apollo(company_name: str) -> dict | None:
    """
    Busca perfiles de RRHH para una empresa usando el endpoint de Search de Apollo.
    """
    url = "https://api.apollo.io/api/v1/people/search"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json"
    }
    payload = {
        "api_key": settings.APOLLO_API_KEY,
        "organization_name": company_name,
        "person_titles": ["Human Resources", "HR", "Recruiter", "Talent Acquisition", "Talent"],
        "per_page": 1
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()
            people = result.get("people", [])

            if people:
                p = people[0]
                telefonos = p.get("phone_numbers", [])
                telefono_principal = telefonos[0].get("sanitized_number") if telefonos else None
                return {
                    "nombre": p.get("first_name"),
                    "apellidos": p.get("last_name"),
                    "linkedin": p.get("linkedin_url"),
                    "email": p.get("email"),
                    "titulo": p.get("title"),
                    "telefono": telefono_principal
                }

    except httpx.HTTPStatusError as e:
        print(f"Error Apollo Search HTTP: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        print(f"Error Apollo Search: {e}")

    return None