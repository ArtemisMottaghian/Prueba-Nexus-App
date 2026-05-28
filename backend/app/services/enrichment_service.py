import os
import httpx
import asyncio
from typing import Optional
from app.core.config import settings


async def enrich_company(company_name: str, raw_text: str = "") -> dict:
    """Investiga los datos de la empresa."""
    try:
        from app.services.scrapers.scraper_companies.scraper_companies import (
            extract_company_data,
        )

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
            "linkedin_url": None,
        }


def clean_company_domain(url: str) -> str:
    """Garantiza que el dominio llegue a Apollo perfectamente limpio (ej: 'empresa.com')."""
    if not url:
        return ""
    return (
        url.replace("https://", "")
        .replace("http://", "")
        .replace("www.", "")
        .strip("/")
        .split("/")[0]
    )


async def search_brave_for_lastname(first_name: str, company_name: str) -> str:
    """
    OSINT: Usa la API de Brave Search para buscar el perfil de LinkedIn
    en la web abierta y extraer los apellidos ocultos.
    """
    brave_key = os.getenv("BRAVE_API_KEY")
    if not brave_key:
        print("      [AVISO BRAVE] No hay BRAVE_API_KEY configurada. Saltando OSINT.")
        return first_name

    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {"Accept": "application/json", "X-Subscription-Token": brave_key}

    # Búsqueda súper dirigida: Nombre + Empresa + "LinkedIn" + España
    query = f'"{first_name}" "{company_name}" "LinkedIn" España'

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url, headers=headers, params={"q": query, "count": 3}
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("web", {}).get("results", [])

                for res in results:
                    title = res.get("title", "")
                    # Buscamos que sea un resultado real de LinkedIn
                    if "LinkedIn" in title or "linkedin.com" in res.get("url", ""):
                        # Los títulos de LinkedIn suelen ser: "Nombre Apellido - Cargo - Empresa | LinkedIn"
                        # Partimos por los separadores comunes para quedarnos solo con el nombre
                        clean_title = (
                            title.split("-")[0].split("|")[0].split("–")[0].strip()
                        )

                        # Verificamos que el nombre original esté dentro y que haya más de una palabra (apellidos)
                        if (
                            first_name.lower() in clean_title.lower()
                            and len(clean_title.split()) > 1
                        ):
                            print(
                                f"      [OSINT BRAVE] ¡Apellidos rescatados de la web!: {clean_title}"
                            )
                            return clean_title
            else:
                print(f"      [DEBUG BRAVE] Código de error HTTP {resp.status_code}")
    except Exception as e:
        print(f"      [ERROR BRAVE SEARCH] {e}")

    return first_name


async def extract_corporate_email(
    full_name: str,
    company_name: str,
    domain: Optional[str],
    person_id: Optional[str],
    fallback_data: dict,
) -> dict:
    """Endpoint de Match B2B: Va directo a por el email forzando con el ID de Apollo si existe."""
    url = "https://api.apollo.io/v1/people/match"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": settings.APOLLO_API_KEY,
    }

    # Inyectamos Nombre, Empresa y, si lo tenemos, el ID interno de Apollo.
    payload = {"name": full_name, "organization_name": company_name}

    # Pasar el ID de Apollo aumenta drásticamente la probabilidad de que gasten el crédito y entreguen el correo
    if person_id:
        payload["id"] = person_id

    c_domain = clean_company_domain(domain)
    if c_domain:
        payload["domain"] = c_domain

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                person = data.get("person", {})

                if person:
                    # Inyectamos en nuestro diccionario el correo corporativo (B2B)
                    if person.get("id"):
                        fallback_data["id"] = person.get("id")
                    if person.get("email"):
                        fallback_data["email"] = person.get("email")
                    if person.get("linkedin_url"):
                        fallback_data["linkedin"] = person.get("linkedin_url")
                    if person.get("title"):
                        fallback_data["titulo"] = person.get("title")
                    if person.get("sanitized_phone"):
                        fallback_data["telefono"] = person.get("sanitized_phone")

                    if person.get("name") and len(person.get("name")) > len(
                        fallback_data["nombre"]
                    ):
                        fallback_data["nombre"] = person.get("name")
            else:
                print(
                    f"      [DEBUG MATCH HTTP] Código {resp.status_code} al extraer datos corporativos."
                )
    except Exception as e:
        print(f"      [ERROR APOLLO MATCH] {e}")

    return fallback_data


async def search_and_extract_recruiter(
    company_name: str, domain: Optional[str] = None, known_name: Optional[str] = None
) -> dict:
    """Lógica unificada con OSINT de Brave y extracción B2B de Apollo."""

    # ==========================================
    # VÍA A: Ya tenemos el nombre completo del Scraper
    # ==========================================
    if known_name and len(known_name.strip().split()) > 1:
        print(
            f"      [APOLLO] VÍA A: Perfil completo detectado ({known_name}). Extrayendo email B2B..."
        )
        fallback_data = {
            "nombre": known_name.strip(),
            "email": None,
            "linkedin": None,
            "titulo": None,
            "telefono": None,
        }
        return await extract_corporate_email(
            known_name.strip(), company_name, domain, None, fallback_data
        )

    # ==========================================
    # VÍA B: Buscar al HR y apoyarnos en Brave si faltan apellidos
    # ==========================================
    print(f"      [APOLLO] VÍA B: Buscando RRHH en {company_name}...")

    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": settings.APOLLO_API_KEY,
    }
    search_url = "https://api.apollo.io/v1/mixed_people/api_search"

    hr_titles = [
        "Recruiter",
        "HR",
        "Talent Acquisition",
        "Human Resources",
        "Selección",
        "People",
        "Recursos Humanos",
        "Talent",
        "Headhunter",
        "Tech Recruiter",
        "IT Recruiter",
        "HRBP",
        "HR Business Partner",
        "People Operations",
        "Talent Sourcer",
        "Director of Talent",
        "TA Specialist",
        "Adquisición de Talento",
        "Digital Recruiter",
        "HR Operations",
        "Talent Manager",
    ]

    payload = {"person_locations": ["Spain"], "person_titles": hr_titles, "per_page": 1}

    c_domain = clean_company_domain(domain)
    if c_domain:
        payload["q_organization_domains"] = c_domain
    else:
        payload["q_organization_name"] = company_name

    fallback_data = {}
    full_name = known_name.strip() if known_name else ""
    person_id = None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(search_url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                people = data.get("people", [])

                if people:
                    p = people[0]
                    first = p.get("first_name") or ""
                    last = p.get("last_name") or ""
                    full_name = p.get("name") or f"{first} {last}".strip()
                    person_id = p.get("id")

                    fallback_data = {
                        "id": person_id,
                        "nombre": full_name,
                        "email": p.get("email"),
                        "linkedin": p.get("linkedin_url"),
                        "titulo": p.get("title"),
                        "telefono": None,
                    }
                    print(
                        f"      [DEBUG RAW APOLLO] Cazado en BD: {full_name} | ID: {person_id}"
                    )
                else:
                    print(
                        f"      [APOLLO] 0 resultados en Search para perfiles de RRHH en esta empresa."
                    )
                    return {}
            else:
                return {}
    except Exception as e:
        print(f"      [ERROR APOLLO SEARCH] {e}")
        return {}

    if fallback_data.get("email"):
        print(
            f"      ✅ [ÉXITO APOLLO] ¡Email extraído directamente desde Search!: {fallback_data['email']}"
        )
        return fallback_data

    # ==========================================
    # EL INTERVENTOR OSINT (Brave Search)
    # ==========================================
    # Si Apollo nos dio solo un nombre (una palabra), lanzamos a Brave al rescate
    if len(full_name.split()) == 1:
        print(
            f"      [OSINT] El perfil solo tiene el nombre '{full_name}'. Investigando en Brave..."
        )
        full_name = await search_brave_for_lastname(full_name, company_name)
        fallback_data["nombre"] = (
            full_name  # Actualizamos la red de seguridad con los apellidos
        )

    # Finalmente, disparamos a Apollo con toda la artillería pesada
    print(
        f"      [APOLLO] Ejecutando extracción de email corporativo para {full_name}..."
    )
    final_data = await extract_corporate_email(
        full_name, company_name, domain, person_id, fallback_data
    )

    if final_data.get("email"):
        print(
            f"      ✅ [ÉXITO APOLLO] ¡Email corporativo extraído!: {final_data['email']}"
        )
    else:
        print(
            f"      ⚠️ [INFO APOLLO] El perfil existe, pero no tiene correo corporativo asociado en la BBDD."
        )

    return final_data


# Código anttiguo, posible borro
# async def enrich_person_with_apollo(first_name: str, last_name: str, company: str, website: Optional[str] = None) -> dict | None:
#   """
#  Encuentra datos adicionales (email y teléfono) de una persona concreta
# usando el endpoint de Match de Apollo.
#    """
#    url = "https://api.apollo.io/api/v1/people/match"
#    headers = {
#        "Cache-Control": "no-cache",
#        "Content-Type": "application/json"
#    }
#    payload = {
#        "api_key": settings.APOLLO_API_KEY,
#        "first_name": first_name,
#        "last_name": last_name,
#        "organization_name": company
#    }
#    if website:
#        payload["domain"] = website

#    try:
#        async with httpx.AsyncClient(timeout=30.0) as client:
#            resp = await client.post(url, json=payload, headers=headers)
#            resp.raise_for_status()
#            result = resp.json()

#            if result.get("person"):
#                p = result["person"]
#                telefonos = p.get("phone_numbers", [])
#                telefono_principal = telefonos[0].get("sanitized_number") if telefonos else None
#               return {
#                   "nombre": p.get("first_name"),
#                   "apellidos": p.get("last_name"),
#                    "linkedin": p.get("linkedin_url"),
#                    "email": p.get("email"),
#                    "titulo": p.get("title"),
#                    "telefono": telefono_principal
#                }

#    except httpx.HTTPStatusError as e:
#        print(f"Error Apollo Match HTTP: {e.response.status_code} - {e.response.text}")
#    except Exception as e:
#        print(f"Error Apollo Match: {e}")

#    return None


# async def search_recruiter_with_apollo(company_name: str) -> dict | None:
#    """
#    Busca perfiles de RRHH para una empresa usando el endpoint de Search de Apollo.
#    """
#    url = "https://api.apollo.io/api/v1/people/search"
#    headers = {
#        "Cache-Control": "no-cache",
#        "Content-Type": "application/json"
#    }
#    payload = {
#        "api_key": settings.APOLLO_API_KEY,
#        "organization_name": company_name,
#        "person_titles": ["Human Resources", "HR", "Recruiter", "Talent Acquisition", "Talent"],
#        "per_page": 1
#    }

#    try:
#        async with httpx.AsyncClient(timeout=30.0) as client:
#            resp = await client.post(url, json=payload, headers=headers)
#            resp.raise_for_status()
#            result = resp.json()
#            people = result.get("people", [])

#            if people:
#                p = people[0]
#                telefonos = p.get("phone_numbers", [])
#                telefono_principal = telefonos[0].get("sanitized_number") if telefonos else None
#                return {
#                    "nombre": p.get("first_name"),
#                    "apellidos": p.get("last_name"),
#                    "linkedin": p.get("linkedin_url"),
#                    "email": p.get("email"),
#                    "titulo": p.get("title"),
#                    "telefono": telefono_principal
#                }

#    except httpx.HTTPStatusError as e:
#        print(f"Error Apollo Search HTTP: {e.response.status_code} - {e.response.text}")
#    except Exception as e:
#        print(f"Error Apollo Search: {e}")

#    return None
