import os
from dotenv import load_dotenv

# 1. Forzamos lectura del .env
load_dotenv(override=True)

import asyncio
from sqlalchemy import select, text
from app.db.connection import AsyncSessionLocal
from app.models.scraper_keyword_model import ScraperKeyword

# Importamos las listas de tu archivo de configuración antiguo
from app.core.scraper_candidates_pdf_config import SECTORES, KEYWORDS, CIUDADES

async def seed_database():
    print("Iniciando la siembra de datos (Seeding)...")
    
    async with AsyncSessionLocal() as db:
        
        # --- LA OPCIÓN NUCLEAR: PYTHON CREA LA TABLA ---
        print(" [!] Forzando la recreación de la tabla desde Python...")
        await db.execute(text("DROP TABLE IF EXISTS scraper_keywords;"))
        await db.execute(text("""
            CREATE TABLE scraper_keywords (
                id SERIAL PRIMARY KEY,
                keyword VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        await db.commit() # Guardamos la creación de la tabla
        print(" [✓] Tabla recreada perfectamente. Iniciando inserción de palabras...\n")
        # -----------------------------------------------

        items_to_insert = []

        # 1. Recopilamos todas las Ciudades
        if isinstance(CIUDADES, list):
            for city in CIUDADES:
                items_to_insert.append({"keyword": city, "type": "city"})

        # 2. Recopilamos las Palabras Clave sueltas
        if isinstance(KEYWORDS, list):
            for kw in KEYWORDS:
                items_to_insert.append({"keyword": kw, "type": "keyword"})

        # 3. Recopilamos las Profesiones dentro del diccionario de Sectores
        if isinstance(SECTORES, dict):
            for sector, profesiones in SECTORES.items():
                for prof in profesiones:
                    items_to_insert.append({"keyword": prof, "type": "keyword"})

        # 4. Insertamos en la Base de Datos
        contador = 0
        for item in items_to_insert:
            # Comprobamos si la palabra ya existe para no meterla dos veces
            query = select(ScraperKeyword).where(ScraperKeyword.keyword == item["keyword"])
            result = await db.execute(query)
            existe = result.scalar_one_or_none()

            if not existe:
                nueva_palabra = ScraperKeyword(
                    keyword=item["keyword"], 
                    type=item["type"], 
                    is_active=True
                )
                db.add(nueva_palabra)
                contador += 1
                print(f" [+] Añadido: {item['keyword']} -> ({item['type']})")

        # Guardamos todos los datos insertados
        await db.commit()
        print(f"\n¡Éxito total! Se han insertado {contador} nuevos registros en la base de datos.")

if __name__ == "__main__":
    asyncio.run(seed_database())