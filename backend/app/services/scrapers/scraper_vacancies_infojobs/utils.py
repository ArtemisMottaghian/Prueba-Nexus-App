import re
import logging
from sqlalchemy import text

def extract_salary(text_input: str | None) -> list[int] | None:
    """
    Extrae valores numéricos para los salarios limpiando el texto de entrada.
    """
    if not text_input:
        return None
    text_clean = text_input.lower().replace("€", "").replace("euros", "")

    matches = re.findall(r'(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:€|euros)', text_clean)

    values = []
    for num_str in matches:
        num_limpio = num_str.replace('.', '').split(',')[0]
        if num_limpio.isdigit() and len(num_limpio) >= 4:
            values.append(int(num_limpio))

    if len(values) >= 2:
        return sorted(values[:2])
    return values[:2] if values else None        


async def upsert_company_sql(db_session, company_data: dict) -> int | None:
    """
    Inserta la empresa en la tabla 'companies' y los datos del reclutador en 'contacts'.
    Devuelve el ID de la empresa creada o actualizada.
    """
    try:
        
        query_company = text("""
            INSERT INTO companies (
                name, company_description,cif, sector, website, linkedin_url, address, original_offer_id, updated_at
            ) VALUES (
                :name, :company_description, :cif, :sector, :website, :linkedin_url, :address, :original_offer_id, CURRENT_TIMESTAMP
            )
            ON CONFLICT (name) 
            DO UPDATE SET 
                company_description = COALESCE(EXCLUDED.company_description, companies.company_description),
                cif = COALESCE(EXCLUDED.cif, companies.cif),
                sector = COALESCE(EXCLUDED.sector, companies.sector),
                website = COALESCE(EXCLUDED.website, companies.website),
                linkedin_url = COALESCE(EXCLUDED.linkedin_url, companies.linkedin_url),
                address = COALESCE(EXCLUDED.address, companies.address),
                original_offer_id = COALESCE(companies.original_offer_id, EXCLUDED.original_offer_id),
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
        """)

        safe_company_data = {
            "name": company_data.get("name"),
            "company_description": company_data.get("company_description"),
            "cif": company_data.get("cif"),
            "sector": company_data.get("sector"),
            "website": company_data.get("website"),
            "linkedin_url": company_data.get("linkedin_url"),
            "address": company_data.get("address"),
            "original_offer_id": company_data.get("original_offer_id")
        }
        
        # Ejecutamos la inserción de empresa (solo 2 parámetros)
        result = await db_session.execute(query_company, safe_company_data)
        company_id = result.scalar()

        # --- PASO 2: GUARDAR CONTACTO EN SU TABLA ---
        first_name = company_data.get("contact_first_name") or company_data.get("recruiter_name") or ""
        last_name = company_data.get("contact_last_name") or company_data.get("recruiter_lastname") or ""
        email = company_data.get("contact_email") or company_data.get("recruiter_email")
        phone = company_data.get("contact_phone") or company_data.get("recruiter_phone")

        if company_id and (first_name or email):
            full_name = f"{first_name} {last_name}".strip()
            if not full_name:
                full_name = "HR Department"

            contact_data = {
                "company_id": company_id,
                "full_name": full_name,
                "email": email,
                "phone": phone
            }

            if email:
                query_contact = text("""
                    INSERT INTO contacts (
                        company_id, full_name, email, phone, job_title, last_interaction
                    ) VALUES (
                        :company_id, :full_name, :email, :phone, 'Recruiter / HR', CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (email) 
                    DO UPDATE SET 
                        full_name = COALESCE(EXCLUDED.full_name, contacts.full_name),
                        phone = COALESCE(EXCLUDED.phone, contacts.phone),
                        last_interaction = CURRENT_TIMESTAMP;
                """)
                # Ejecutamos contacto con email (solo 2 parámetros)
                await db_session.execute(query_contact, contact_data)
            else:
                query_contact_no_email = text("""
                    INSERT INTO contacts (
                        company_id, full_name, email, phone, job_title, last_interaction
                    ) VALUES (
                        :company_id, :full_name, :email, :phone, 'Recruiter / HR', CURRENT_TIMESTAMP
                    )
                """)
                # Ejecutamos contacto sin email (solo 2 parámetros)
                try:
                    await db_session.execute(query_contact_no_email, contact_data)
                except Exception as e_contact:
                    logging.warning(f"No se pudo guardar contacto sin email: {e_contact}")

        await db_session.commit()
        return company_id

    except Exception as e:
        await db_session.rollback()
        logging.error(f"[ERROR BBDD] Fallo al guardar empresa {company_data.get('name')}: {e}")
        return None


async def upsert_job_offer(db_session, job_data: dict, model_class=None) -> bool:
    """
    Inserta una nueva oferta de empleo mediante SQL directo.
    Usa 'company_id' para la relación correcta en la base de datos.
    """    
    # Eliminamos company_name del diccionario para que no choque con el SQL
    job_data.pop("company_name", None)
    job_data.pop("company_description", None)

    # Query usando company_id
    query = text("""
        INSERT INTO job_offers (
            portal_id, company_id, external_id, title, location, offer_url, 
            job_description, published_at, sector, salary_min, salary_max, 
            contract_type, contract_time, work_modality
        ) VALUES (
            :portal_id, :company_id, :external_id, :title, :location, :offer_url, 
            :job_description, :published_at, :sector, :salary_min, :salary_max, 
            :contract_type, :contract_time, :work_modality
        )
        ON CONFLICT (portal_id, external_id) 
        DO UPDATE SET 
            company_id = EXCLUDED.company_id,
            title = EXCLUDED.title,
            location = EXCLUDED.location,
            offer_url = EXCLUDED.offer_url,
            job_description = EXCLUDED.job_description,
            salary_min = EXCLUDED.salary_min,
            salary_max = EXCLUDED.salary_max,
            contract_type = EXCLUDED.contract_type,
            contract_time = EXCLUDED.contract_time,
            work_modality = EXCLUDED.work_modality,
            sector = EXCLUDED.sector
    """)
    try:
        await db_session.execute(query, job_data)
        await db_session.commit()
        return True
    except Exception as e:
        await db_session.rollback()
        logging.error(f"[ERROR BBDD] Fallo al guardar la oferta {job_data.get('external_id')}: {e}")
        return False