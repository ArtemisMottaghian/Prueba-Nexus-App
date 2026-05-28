import asyncio
# Importas solo la función que necesitas de tu orquestador
from app.services.orchestrator_vacancies import add_contact_to_apollo_sequence

async def run_test():
    print("🚀 Lanzando prueba aislada de Apollo...")
    
    # ID de prueba (el que acabas de guardar en Apollo de Miguel o Ander)
    id_contacto_prueba = "69a28748504bef000123287d" 
    
    # Ejecutamos solo esa función
    resultado = await add_contact_to_apollo_sequence(id_contacto_prueba)
    
    if resultado:
        print("✅ Prueba superada con éxito.")
    else:
        print("❌ La prueba falló.")

if __name__ == "__main__":
    asyncio.run(run_test())