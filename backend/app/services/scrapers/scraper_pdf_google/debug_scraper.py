"""
Script de diagnóstico - Ejecuta esto directamente para ver qué falla:
    python debug_scraper.py

Prueba por separado:
  1. Descarga y lectura del PDF
  2. Llamada a Claude API para extraer el nombre
  3. Búsqueda de LinkedIn
"""

import asyncio
import os
import re
import io
import json
import urllib.parse
import aiohttp
from PyPDF2 import PdfReader
from dotenv import load_dotenv

load_dotenv()

# ── Pon aquí una URL de un PDF de CV real para probar ──────────────────────────
TEST_PDF_URL = "https://gvaoberta.gva.es/auto/WSRECI/recci/12825_CV.pdf"
# ──────────────────────────────────────────────────────────────────────────────


async def test_pdf_download(pdf_url: str) -> str:
    print("\n" + "="*60)
    print("TEST 1: DESCARGA Y LECTURA DEL PDF")
    print("="*60)
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(pdf_url, timeout=15, ssl=False) as response:
                print(f"  HTTP status: {response.status}")
                if response.status == 200:
                    raw = await response.read()
                    print(f"  Bytes descargados: {len(raw)}")
                    reader = PdfReader(io.BytesIO(raw))
                    print(f"  Páginas en el PDF: {len(reader.pages)}")
                    text = "".join(
                        page.extract_text() + "\n"
                        for page in reader.pages[:4]
                        if page.extract_text()
                    )
                    print(f"  Caracteres extraídos: {len(text)}")
                    print(f"\n  --- Primeros 600 caracteres del texto ---")
                    print(text[:600])
                    print("  -----------------------------------------")
                    return text
                else:
                    print(f"  ERROR: El servidor devolvió {response.status}")
                    return ""
    except Exception as e:
        print(f"  EXCEPCIÓN al descargar: {type(e).__name__}: {e}")
        return ""


async def test_claude_api(text: str):
    print("\n" + "="*60)
    print("TEST 2: LLAMADA A CLAUDE API")
    print("="*60)

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("  ERROR CRÍTICO: ANTHROPIC_API_KEY no está definida en el .env")
        return
    print(f"  API Key detectada: {api_key[:12]}...{api_key[-4:]}")

    snippet = text[:800].strip()
    if not snippet:
        print("  ERROR: El texto del PDF está vacío, no se puede llamar a Claude")
        return

    prompt = f"""Eres un extractor de datos de CVs. Tu única tarea es encontrar el nombre completo de la persona que escribió este CV.

REGLAS ESTRICTAS:
- Devuelve SOLO un JSON con dos campos: "first_name" y "last_name"
- "first_name": el nombre de pila (ej: "María", "Juan Carlos")
- "last_name": los apellidos (ej: "García López", "Martínez")
- Si el texto NO contiene un nombre de persona real, devuelve first_name: "Candidato" y last_name: "PDF"
- NO incluyas títulos (Dr., Lic., D., Dña.), cargos (Secretario, Director, Consultor) ni palabras que no sean el nombre propio
- NO inventes nombres. Si no estás seguro, devuelve "Candidato" y "PDF"

TEXTO DEL CV:
{snippet}

Responde ÚNICAMENTE con el JSON, sin explicaciones ni markdown."""

    print(f"\n  Snippet enviado a Claude (primeros 200 chars):")
    print(f"  {snippet[:200]}")
    print()

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 100,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=15
            ) as resp:
                print(f"  HTTP status Claude API: {resp.status}")
                raw_response = await resp.json()

                if resp.status != 200:
                    print(f"  ERROR de la API: {raw_response}")
                    return

                print(f"  Respuesta completa de Claude: {raw_response}")
                raw_text = raw_response["content"][0]["text"].strip()
                print(f"  Texto extraído: '{raw_text}'")

                clean = re.sub(r"```json|```", "", raw_text).strip()
                parsed = json.loads(clean)
                print(f"  JSON parseado: {parsed}")
                print(f"\n  ✓ NOMBRE EXTRAÍDO: {parsed.get('first_name')} {parsed.get('last_name')}")

    except json.JSONDecodeError as e:
        print(f"  ERROR: Claude no devolvió JSON válido. Raw: '{raw_text}' | Error: {e}")
    except Exception as e:
        print(f"  EXCEPCIÓN: {type(e).__name__}: {e}")


async def test_linkedin_search(first_name: str, last_name: str):
    print("\n" + "="*60)
    print(f"TEST 3: BÚSQUEDA DE LINKEDIN para '{first_name} {last_name}'")
    print("="*60)

    if first_name == "Candidato":
        print("  SALTADO: El nombre es 'Candidato', no tiene sentido buscar.")
        return

    linkedin_pattern = re.compile(r'https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9_\-]+')
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    queries = [
        f'"{first_name} {last_name}" site:linkedin.com/in/',
        f'"{first_name} {last_name.split()[0]}" site:linkedin.com/in/' if len(last_name.split()) > 1 else None,
    ]

    for q in queries:
        if not q:
            continue
        encoded = urllib.parse.quote_plus(q)
        for engine_name, search_url in [
            ("Yahoo",      f"https://es.search.yahoo.com/search?p={encoded}"),
            ("DuckDuckGo", f"https://html.duckduckgo.com/html/?q={encoded}"),
        ]:
            print(f"\n  Probando {engine_name} con query: {q}")
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(search_url, headers=headers, timeout=10) as resp:
                        print(f"    HTTP status: {resp.status}")
                        if resp.status == 200:
                            decoded = urllib.parse.unquote(await resp.text())
                            match = linkedin_pattern.search(decoded)
                            if match:
                                print(f"    ✓ URL ENCONTRADA: {match.group(0)}")
                                return
                            else:
                                # Mostrar fragmento de la respuesta para diagnosticar
                                print(f"    No se encontró URL de LinkedIn.")
                                # Buscar si al menos aparece "linkedin" en la respuesta
                                if "linkedin" in decoded.lower():
                                    idx = decoded.lower().find("linkedin")
                                    print(f"    'linkedin' aparece en respuesta, contexto: ...{decoded[max(0,idx-30):idx+80]}...")
                                else:
                                    print(f"    'linkedin' no aparece en la respuesta en absoluto.")
                        else:
                            print(f"    El motor devolvió status {resp.status}")
            except Exception as e:
                print(f"    EXCEPCIÓN: {type(e).__name__}: {e}")
            await asyncio.sleep(1)

    print("\n  No se encontró perfil de LinkedIn con ningún motor.")


async def main():
    print("DIAGNÓSTICO DEL SCRAPER DE CVs")
    print("="*60)

    # TEST 1: PDF
    text = await test_pdf_download(TEST_PDF_URL)

    # TEST 2: Claude API (solo si hay texto)
    if text.strip():
        await test_claude_api(text)
    else:
        print("\nTEST 2 y 3 SALTADOS: No se pudo extraer texto del PDF.")
        print("Probando Claude API con texto de ejemplo...")
        sample = "Juan García Martínez\nDesarrollador Backend Senior\nEmail: juan.garcia@email.com\nTeléfono: 612345678\nExperiencia: 5 años en Python y FastAPI"
        await test_claude_api(sample)
        await test_linkedin_search("Juan", "García Martínez")
        return

    # TEST 3: LinkedIn (usar el nombre que devuelva Claude o uno de ejemplo)
    await test_linkedin_search("Juan", "García Martínez")


if __name__ == "__main__":
    asyncio.run(main())