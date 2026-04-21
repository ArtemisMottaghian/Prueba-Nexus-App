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

    numbers = re.findall(r'\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b', text_clean)

    values = []
    for n in numbers:
        num_limpio = n.replace('.', '').split(',')[0]
        if num_limpio.isdigit() and len(num_limpio) >= 4:
            values.append(int(num_limpio))

    return values[:2] if values else None        


async def upsert_company_sql(db_session, company_data: dict) -> int:
    """
    Inserta la empresa extraída por la IA en la BD asíncrona y devuelve su ID.
    """
    query = text("""
        INSERT INTO companies (
            name, cif, sector, website, linkedin_url, address, 
            contact_first_name, contact_last_name, contact_email, contact_phone, updated_at
        ) VALUES (
            :name, :cif, :sector, :website, :linkedin_url, :address,
            :contact_first_name, :contact_last_name, :contact_email, :contact_phone, CURRENT_TIMESTAMP
        )
        ON CONFLICT (name) 
        DO UPDATE SET 
            cif = COALESCE(EXCLUDED.cif, companies.cif),
            sector = COALESCE(EXCLUDED.sector, companies.sector),
            website = COALESCE(EXCLUDED.website, companies.website),
            linkedin_url = COALESCE(EXCLUDED.linkedin_url, companies.linkedin_url),
            address = COALESCE(EXCLUDED.address, companies.address),
            contact_first_name = COALESCE(EXCLUDED.contact_first_name, companies.contact_first_name),
            contact_last_name = COALESCE(EXCLUDED.contact_last_name, companies.contact_last_name),
            contact_email = COALESCE(EXCLUDED.contact_email, companies.contact_email),
            contact_phone = COALESCE(EXCLUDED.contact_phone, companies.contact_phone),
            updated_at = CURRENT_TIMESTAMP
        RETURNING id;
    """)
    try:
        result = await db_session.execute(query, company_data)
        await db_session.commit()
        return result.scalar()
    except Exception as e:
        await db_session.rollback()
        logging.error(f"[ERROR BBDD] Fallo al guardar empresa {company_data.get('name')}: {e}")
        return None


async def upsert_job_offer(db_session, job_data: dict, model_class=None) -> bool:
    """
    Inserta una nueva oferta de empleo mediante SQL directo, ignorando el modelo ORM 
    para evitar errores de columnas faltantes.
    """
    # Escudo preventivo: nos aseguramos de que los campos existan en el diccionario
    if 'recruiter_name' not in job_data: job_data['recruiter_name'] = None
    if 'company_description' not in job_data: job_data['company_description'] = None
    if 'company_name' not in job_data: job_data['company_name'] = None

    query = text("""
        INSERT INTO job_offers (
            portal_id, company_id, company_name, external_id, title, location, offer_url, 
            job_description, company_description, published_at, sector, salary_min, salary_max, 
            contract_type, contract_time, work_modality, recruiter_name
        ) VALUES (
            :portal_id, :company_id, :company_name, :external_id, :title, :location, :offer_url, 
            :job_description, :company_description, :published_at, :sector, :salary_min, :salary_max, 
            :contract_type, :contract_time, :work_modality, :recruiter_name
        )
        ON CONFLICT (portal_id, external_id) 
        DO UPDATE SET 
            company_id = EXCLUDED.company_id,
            company_name = EXCLUDED.company_name,
            title = EXCLUDED.title,
            location = EXCLUDED.location,
            offer_url = EXCLUDED.offer_url,
            job_description = EXCLUDED.job_description,
            company_description = EXCLUDED.company_description,
            salary_min = EXCLUDED.salary_min,
            salary_max = EXCLUDED.salary_max,
            contract_type = EXCLUDED.contract_type,
            contract_time = EXCLUDED.contract_time,
            work_modality = EXCLUDED.work_modality,
            sector = EXCLUDED.sector,
            recruiter_name = EXCLUDED.recruiter_name
    """)
    try:
        await db_session.execute(query, job_data)
        await db_session.commit()
        return True
    except Exception as e:
        await db_session.rollback()
        logging.error(f"[ERROR BBDD] Fallo al guardar la oferta {job_data.get('external_id')}: {e}")
        return False