import os
import asyncio
import httpx
from dotenv import load_dotenv

# Cargamos variables del entorno
load_dotenv()

APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")

if not APOLLO_API_KEY:
    raise ValueError("❌ No se ha encontrado APOLLO_API_KEY en el .env")

async def ver_mis_buzones():
    url = "https://api.apollo.io/v1/email_accounts"
    
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY
    }

    print("Buscando buzones de correo activos...")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 200:
                cuentas = resp.json().get("email_accounts", [])
                
                print("\n=== TUS BUZONES DISPONIBLES EN APOLLO ===")
                for cuenta in cuentas:
                    print(f"📧 Correo: {cuenta.get('email')}")
                    print(f"🔑 ID Real: {cuenta.get('id')}")
                    print(f"🟢 Estado: {cuenta.get('status', 'Desconocido')}") 
                    print("-" * 40)
            else:
                print(f"❌ Error al conectar: {resp.status_code}")
                print(resp.text)
                
    except Exception as e:
        print(f"❌ Excepción: {e}")

if __name__ == "__main__":
    asyncio.run(ver_mis_buzones())