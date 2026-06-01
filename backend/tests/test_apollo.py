import asyncio
import httpx
from dotenv import load_dotenv
import os

load_dotenv()


APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")
if not APOLLO_API_KEY:
    raise ValueError("❌ No se encontró APOLLO_API_KEY en el .env")

async def listar_todos_los_campos():
    url = "https://api.apollo.io/v1/typed_custom_fields"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY
    }

    print("Buscando TODOS los campos personalizados en la cuenta de Apollo...\n")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 200:
                campos = resp.json().get("typed_custom_fields", [])
                
                if not campos:
                    print("⚠️ Apollo dice que no hay NINGÚN campo creado en toda la cuenta.")
                    return

                print("=== LISTA DE CAMPOS REALES EN LA BASE DE DATOS ===")
                for campo in campos:
                    nombre = campo.get("name")
                    campo_id = campo.get("id")
                    print(f"📝 Nombre exacto: '{nombre}'")
                    print(f"🔑 ID: {campo_id}")
                    print("-" * 40)
            else:
                print(f"❌ Error al conectar: {resp.status_code}")
                
    except Exception as e:
        print(f"❌ Excepción: {e}")

if __name__ == "__main__":
    asyncio.run(listar_todos_los_campos())