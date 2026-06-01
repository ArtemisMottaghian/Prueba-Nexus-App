import os
import asyncio
import httpx
from dotenv import load_dotenv

# Cargamos el archivo .env sí o sí
load_dotenv()

# --- VARIABLES EXTRAÍDAS DEL .ENV ---
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")
APOLLO_SEQUENCE_ID = os.getenv("APOLLO_SEQUENCE_ID")
APOLLO_CUSTOM_FIELD_OFFER_TITLE = os.getenv("APOLLO_CUSTOM_FIELD_OFFER_TITLE")
APOLLO_EMAIL_ACCOUNT_ID = os.getenv("APOLLO_EMAIL_ACCOUNT_ID")

# 🔥 SEGURO: Comprobamos que ninguna haya llegado vacía
if not all([APOLLO_API_KEY, APOLLO_SEQUENCE_ID, APOLLO_CUSTOM_FIELD_OFFER_TITLE, APOLLO_EMAIL_ACCOUNT_ID]):
    raise ValueError("❌ Faltan variables de Apollo en tu .env. Revisa que estén todas correctamente escritas.")

async def save_contact_standalone(email: str, first_name: str, offer_title: str) -> str:
    """Guarda el contacto en Apollo usando las variables del entorno."""
    url = "https://api.apollo.io/v1/contacts"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY
    }
    
    payload = {
        "email": email,
        "first_name": first_name,
        "typed_custom_fields": {
            APOLLO_CUSTOM_FIELD_OFFER_TITLE: offer_title
        }
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status() 
        data = resp.json()
        return data["contact"]["id"]

async def add_to_sequence_standalone(contact_id: str) -> dict:
    """Inyecta el contacto en la secuencia enviando el ID del buzón."""
    url = f"https://api.apollo.io/v1/emailer_campaigns/{APOLLO_SEQUENCE_ID}/add_contact_ids"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY
    }
    
    payload = {
        "contact_ids": [contact_id],
        "emailer_campaign_id": APOLLO_SEQUENCE_ID,
        "send_email_from_email_account_id": APOLLO_EMAIL_ACCOUNT_ID
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        
        if resp.status_code not in (200, 201):
            raise Exception(f"Detalle exacto de Apollo (HTTP {resp.status_code}): {resp.text}")
            
        return resp.json()

async def run_test():
    print("🚀 Iniciando prueba completa de Apollo (Leyendo desde .env)...")

    print("\n[PASO 1] Variables cargadas correctamente desde el entorno.")

    print("\n[PASO 2] Guardando a Ander (Prueba Automática)...")
    try:
        contacto_id = await save_contact_standalone(
            email="ander.vilarino@ara-tech.es",
            first_name="Ander (Prueba Automática)",
            offer_title="Senior Backend Developer (Python/FastAPI)"
        )
        print(f"      [APOLLO CRM] 💾 ¡Contacto guardado! (ID: {contacto_id})")
        print("✅ Contacto guardado con éxito en el CRM.")
    except Exception as e:
        print(f"❌ Falló el guardado del contacto: {e}")
        return

    print("\n[PASO 3] Inyectando el contacto en la secuencia de correos...")
    try:
        await add_to_sequence_standalone(contacto_id)
        print("      [APOLLO SUCCESS] Inyección confirmada por la API.")
        print("\n🎉 ¡PRUEBA SUPERADA CON ÉXITO!")
        print("Revisa la secuencia en Apollo. El contacto ya está dentro y el correo debería enviarse en breve.")
    except Exception as e:
        print(f"      [APOLLO ERROR] Fallo al inyectar en secuencia:\n{e}")
        print("\n❌ Falló la inyección en la secuencia.")

if __name__ == "__main__":
    asyncio.run(run_test())