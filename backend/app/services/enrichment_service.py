import os
import httpx
import asyncio
from typing import Optional
from app.core.config import settings

# 🔥 MEMORIA CACHÉ: Guarda el ID para no pedírselo a Apollo en cada iteración
_TITULO_VACANTE_FIELD_ID = None

async def get_titulo_vacante_field_id() -> str | None:
    """Devuelve el ID del Custom Field directamente desde las variables de entorno."""
    import os
    from app.core.config import settings
    
    # Lee el ID fijo del .env
    field_id = os.getenv("APOLLO_CUSTOM_FIELD_OFFER_TITLE")
    
    if field_id:
        return field_id
        
    print("      [APOLLO AVISO] No se encontró APOLLO_CUSTOM_FIELD_OFFER_TITLE en el .env")
    return None


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
    """Garantiza que el dominio llegue a Apollo perfectamente limpio."""
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
    """OSINT: Extrae apellidos ocultos desde la web abierta."""
    brave_key = os.getenv("BRAVE_API_KEY")
    if not brave_key:
        return first_name

    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {"Accept": "application/json", "X-Subscription-Token": brave_key}
    query = f'"{first_name}" "{company_name}" "LinkedIn" España'

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers, params={"q": query, "count": 3})
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("web", {}).get("results", [])

                for res in results:
                    title = res.get("title", "")
                    if "LinkedIn" in title or "linkedin.com" in res.get("url", ""):
                        clean_title = title.split("-")[0].split("|")[0].split("–")[0].strip()
                        if first_name.lower() in clean_title.lower() and len(clean_title.split()) > 1:
                            print(f"      [OSINT BRAVE] ¡Apellidos rescatados!: {clean_title}")
                            return clean_title
    except Exception as e:
        print(f"      [ERROR BRAVE SEARCH] {e}")

    return first_name


async def extract_corporate_email(
    full_name: str, company_name: str, domain: Optional[str], person_id: Optional[str], fallback_data: dict
) -> dict:
    """Endpoint de Match B2B para emails corporativos."""
    url = "https://api.apollo.io/v1/people/match"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": settings.APOLLO_API_KEY,
    }

    payload = {"name": full_name, "organization_name": company_name}
    if person_id: payload["id"] = person_id
    c_domain = clean_company_domain(domain)
    if c_domain: payload["domain"] = c_domain

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                person = resp.json().get("person", {})
                if person:
                    fallback_data["id"] = person.get("id", fallback_data.get("id"))
                    fallback_data["email"] = person.get("email", fallback_data.get("email"))
                    fallback_data["linkedin"] = person.get("linkedin_url", fallback_data.get("linkedin"))
                    fallback_data["titulo"] = person.get("title", fallback_data.get("titulo"))
                    fallback_data["telefono"] = person.get("sanitized_phone", fallback_data.get("telefono"))
                    if person.get("name") and len(person.get("name")) > len(fallback_data.get("nombre", "")):
                        fallback_data["nombre"] = person.get("name")
    except Exception as e:
        print(f"      [ERROR APOLLO MATCH] {e}")

    return fallback_data


async def save_contact_to_apollo_crm(
    full_name: str, 
    email: str, 
    title: str, 
    company: str, 
    domain: str = None, 
    offer_title: str = None,
    custom_field_id: str = None
) -> str | None:
    """Guarda el contacto e inyecta dinámicamente los Custom Fields si existen."""
    url = "https://api.apollo.io/v1/contacts"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": settings.APOLLO_API_KEY
    }
    
    parts = full_name.strip().split(" ", 1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""
    exact_domain = email.split("@")[-1] if email and "@" in email else domain

    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "title": title,
        "organization_name": company,
        "website_url": exact_domain, 
        "label_names": ["Nexus App Automático"] 
    }

    # 🔥 INYECCIÓN DINÁMICA DEL CUSTOM FIELD PARA EL TÍTULO
    if offer_title and custom_field_id:
        payload["typed_custom_fields"] = {
            custom_field_id: offer_title
        }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                contact_id = resp.json().get("contact", {}).get("id")
                print(f"      [APOLLO CRM] 💾 ¡Contacto guardado! (ID: {contact_id} | Email: {email})")
                return contact_id
            else:
                error_data = resp.text
                print(f"      [APOLLO CRM ERROR] No se guardó: {error_data}")
                return None
    except Exception as e:
        print(f"      [APOLLO CRM EXCEPCIÓN] {e}")
        return None


async def search_and_extract_recruiter(
    company_name: str, domain: Optional[str] = None, known_name: Optional[str] = None, offer_title: Optional[str] = None
) -> dict:
    """Lógica principal de extracción y mapeo."""

    final_result = {}
    person_id = None
    full_name = known_name.strip() if known_name else ""

    # ==========================================
    # VÍA A: Extracción directa si hay nombre
    # ==========================================
    if known_name and len(known_name.strip().split()) > 1:
        fallback_data = {"nombre": known_name.strip(), "email": None, "linkedin": None, "titulo": "Recruiter", "telefono": None}
        via_a_data = await extract_corporate_email(known_name.strip(), company_name, domain, None, fallback_data)
        if via_a_data.get("email"):
            final_result = via_a_data
        else:
            full_name = "" 

    # ==========================================
    # VÍA B: Búsqueda del HR y OSINT
    # ==========================================
    if not final_result.get("email"):
        search_url = "https://api.apollo.io/v1/mixed_people/api_search"
        headers = {"Cache-Control": "no-cache", "Content-Type": "application/json", "x-api-key": settings.APOLLO_API_KEY}
        
        hr_titles = [
            "Recruiter", "HR", "Talent Acquisition", "Human Resources", "Selección", 
            "People", "Recursos Humanos", "Talent", "Headhunter", "Tech Recruiter"
        ]
        payload = {"person_locations": ["Spain"], "person_titles": hr_titles, "per_page": 1}

        c_domain = clean_company_domain(domain)
        if c_domain: payload["q_organization_domains"] = c_domain
        else: payload["q_organization_name"] = company_name

        fallback_data = {}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(search_url, json=payload, headers=headers)
                if resp.status_code == 200:
                    people = resp.json().get("people", [])
                    if people:
                        p = people[0]
                        first, last = p.get("first_name") or "", p.get("last_name") or ""
                        full_name = p.get("name") or f"{first} {last}".strip()
                        person_id = p.get("id")
                        fallback_data = {"id": person_id, "nombre": full_name, "email": p.get("email"), "linkedin": p.get("linkedin_url"), "titulo": p.get("title")}
        except Exception as e:
            pass

        if fallback_data.get("email"):
            final_result = fallback_data
        elif fallback_data.get("nombre"):
            if len(full_name.split()) == 1:
                full_name = await search_brave_for_lastname(full_name, company_name)
                fallback_data["nombre"] = full_name 
            final_result = await extract_corporate_email(full_name, company_name, domain, person_id, fallback_data)

    # ==========================================
    # 🛡️ FILTRO ESTRICTO: SOLO CORREOS REALES
    # ==========================================
    if final_result.get("email"):
        email_dom = final_result["email"].lower().split("@")[-1]
        raiz_email = email_dom.split(".")[0]
        nombre_emp_limpio = company_name.lower().replace(" ", "").replace(",", "").replace(".", "")
        raiz_web = clean_company_domain(domain).split(".")[0].lower() if domain else ""
        
        # Eliminamos la variable es_prueba ya que no la necesitamos
        coincide_empresa = (raiz_email in nombre_emp_limpio) or (nombre_emp_limpio in raiz_email) or (raiz_web and raiz_web in raiz_email) or (raiz_web and raiz_email in raiz_web)
        
        if not coincide_empresa:
            print(f"      ⚠️ [FILTRO] Se descarta el email {final_result['email']} (no coincide con la empresa).")
            final_result["email"] = None 


    # ==========================================
    # PASO FINAL: OBTENER ID DEL CAMPO Y GUARDAR
    # ==========================================
    if final_result.get("email"):
        
        # Obtenemos el ID del Custom Field consultando a la API
        custom_field_id = None
        if offer_title:
            custom_field_id = await get_titulo_vacante_field_id()

        # Al quitar las pruebas, la empresa siempre es la real
        apollo_contact_id = await save_contact_to_apollo_crm(
            full_name=final_result.get("nombre", ""),
            email=final_result.get("email"),
            title=final_result.get("titulo", "Recruiter"),
            company=company_name, 
            domain=domain,
            offer_title=offer_title,
            custom_field_id=custom_field_id
        )
        final_result["apollo_contact_id"] = apollo_contact_id
        return final_result

    return {"nombre": known_name}


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