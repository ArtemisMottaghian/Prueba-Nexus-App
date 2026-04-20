import psycopg2
import json
import os
# import google.generativeai as genai  # <-- Descomentar cuando uses Gemini
os.environ["PGCLIENTENCODING"] = "utf-8"

# ==========================================
# 1. CONFIGURACIÓN DE BASE DE DATOS
# ==========================================
DB_CONFIG = {
    "dbname": "nexus-app-empresa",
    "user": "postgres",
    "password": "admin",
    "host": "localhost",
    "port": "5433"
}

# ==========================================
# 2. MOTOR DE EXTRACCIÓN (IA COMENTADA)
# ==========================================
def extract_company_data(raw_text: str, basic_company_name: str) -> dict:
    """
    Función que recibe el texto crudo del scraper y extrae datos de la empresa.
    Actualmente devuelve datos simulados para probar la Base de Datos.
    """
    
    # --- INICIO BLOQUE GEMINI (COMENTADO PARA EL FUTURO) ---
    # genai.configure(api_key="TU_API_KEY_AQUI")
    # model = genai.GenerativeModel('gemini-2.5-flash')
    # 
    # prompt = f"""
    # Actúa como un extractor de datos experto. Extrae la información de la 
    # empresa y contacto del siguiente texto. 
    # Devuelve ÚNICAMENTE un JSON con estas claves (usa null si no lo encuentras):
    # "name", "cif", "sector", "website", "linkedin_url", "address", 
    # "contact_first_name", "contact_last_name", "contact_email", "contact_phone".
    # 
    # Texto: {raw_text}
    # """
    # 
    # response = model.generate_content(
    #     prompt,
    #     generation_config={"response_mime_type": "application/json"}
    # )
    # return json.loads(response.text)
    # --- FIN BLOQUE GEMINI ---

    # Para realizar pruebas de BBDD AHORA, devolvemos este diccionario simulado.
    # Cuando descomentes Gemini, puedes borrar o comentar este 'return'.
    print(f"-> [Simulación] Extrayendo datos simulados para la empresa: {basic_company_name}")
    return {
        "name": basic_company_name, # El scraper normal suele poder sacar el nombre por HTML
        "cif": "B12345678",
        "sector": "Tecnología",
        "website": f"www.{basic_company_name.lower().replace(' ', '')}.com",
        "linkedin_url": None,
        "address": "Calle Falsa 123, Madrid",
        "contact_first_name": "Laura",
        "contact_last_name": "Gómez",
        "contact_email": f"rrhh@{basic_company_name.lower().replace(' ', '')}.com",
        "contact_phone": "+34 600 000 000"
    }

# ==========================================
# 3. LÓGICA DE BBDD (UPSERT Y RELACIONES)
# ==========================================
def upsert_company(cursor, company_data: dict) -> int:
    """
    Inserta la empresa en la tabla 'companies'. Si el nombre ya existe,
    actualiza los datos y devuelve el ID. Así evitamos duplicados.
    """
    query = """
        INSERT INTO companies (
            name, cif, sector, website, linkedin_url, address, 
            contact_first_name, contact_last_name, contact_email, contact_phone, updated_at
        ) VALUES (
            %(name)s, %(cif)s, %(sector)s, %(website)s, %(linkedin_url)s, %(address)s,
            %(contact_first_name)s, %(contact_last_name)s, %(contact_email)s, %(contact_phone)s, CURRENT_TIMESTAMP
        )
        ON CONFLICT (name) 
        DO UPDATE SET 
            sector = COALESCE(EXCLUDED.sector, companies.sector),
            website = COALESCE(EXCLUDED.website, companies.website),
            contact_email = COALESCE(EXCLUDED.contact_email, companies.contact_email),
            updated_at = CURRENT_TIMESTAMP
        RETURNING id;
    """
    cursor.execute(query, company_data)
    # Retornamos el ID recién creado o el ID de la empresa existente
    return cursor.fetchone()[0] 

def insert_job_offer(cursor, job_data: dict, company_id: int):
    """
    Inserta la oferta de trabajo y la relaciona con el company_id.
    """
    query = """
        INSERT INTO job_offers (
            company_id, title, location, offer_url, job_description
        ) VALUES (
            %(company_id)s, %(title)s, %(location)s, %(offer_url)s, %(job_description)s
        )
    """
    # Inyectamos el ID de la empresa en los datos de la oferta
    job_data['company_id'] = company_id
    cursor.execute(query, job_data)

# ==========================================
# 4. FUNCIÓN PRINCIPAL (PIPELINE)
# ==========================================
def process_scraped_job(scraped_html_text: str, basic_company_name: str, job_title: str):
    """
    Simula el flujo completo por cada oferta extraída.
    """
    print(f"\n--- Iniciando procesamiento para vacante: {job_title} ---")
    
    # 1. Extraemos o estructuramos los datos (Actualmente simula la IA)
    company_data = extract_company_data(scraped_html_text, basic_company_name)
    
    if not company_data or not company_data.get("name"):
        print("No se encontró nombre de empresa. Descartando oferta.")
        return

    # 2. Conectamos a la base de datos
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # 3. Guardamos/Actualizamos la empresa y obtenemos su ID
        print("-> Guardando empresa en BBDD...")
        company_id = upsert_company(cursor, company_data)
        print(f"-> Empresa guardada con ID: {company_id}")

        # 4. Preparamos los datos de la oferta y la guardamos
        job_data = {
            "title": job_title,
            "location": "Madrid", # Normalmente lo sacarías del scraper
            "offer_url": "https://portal.com/oferta/123",
            "job_description": scraped_html_text
        }
        
        print("-> Guardando oferta vinculada...")
        insert_job_offer(cursor, job_data, company_id)

        # 5. Confirmamos la transacción
        conn.commit()
        print("-> ¡Éxito! Transacción completada en BBDD.")

    except psycopg2.Error as e:
        print(f"-> [ERROR de BBDD]: {e}")
        if conn:
            conn.rollback() # Revertimos todo si algo falla
    finally:
        if conn:
            cursor.close()
            conn.close()

# ==========================================
# EJECUCIÓN DE PRUEBA
# ==========================================
if __name__ == "__main__":
    texto_oferta_1 = "Buscamos Desarrollador Python para TechNova con experiencia de 3 años. Contacto: laura@technova.com"
    
    # Simulamos que tu scraper de Infojobs/LinkedIn encuentra dos vacantes de la misma empresa
    process_scraped_job(texto_oferta_1, "TechNova", "Desarrollador Backend Python")
    
    # Al ejecutar esta segunda vacante, la función ON CONFLICT evitará crear "TechNova" de nuevo,
    # simplemente usará el ID existente y vinculará la oferta.
    process_scraped_job("Buscamos experto en React.", "TechNova", "Frontend Developer React")