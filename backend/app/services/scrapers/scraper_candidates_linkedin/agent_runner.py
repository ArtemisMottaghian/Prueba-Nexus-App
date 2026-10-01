import os
import io
import asyncio
from typing import Optional
from dotenv import load_dotenv
from pypdf import PdfReader
from playwright.async_api import async_playwright
from langchain_groq import ChatGroq
# Si no usas la BD todavía, puedes comentar la siguiente línea
# from app.schemas.candidates_schemas import CandidateCreate as CandidateSchema

# 1. Configuración Inicial
load_dotenv()

# Rutas para persistencia de sesión
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIES_PATH = os.path.join(CURRENT_DIR, "cookies.json")

# Instancia de Groq
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("  ERROR CRÍTICO: ¡Python no encuentra la llave! El valor de api_key es 'None'.")
    print("  Revisa que el .env esté en la carpeta 'backend' y la variable se llame GROQ_API_KEY.")
    import sys
    sys.exit(1)
llm = ChatGroq(
    model="llama3-70b-8192", 
    api_key=api_key, 
    temperature=0
)

async def login_to_linkedin(page):
    """
    Realiza el login automático si las cookies no existen o han caducado.
    """
    email = os.getenv("LINKEDIN_EMAIL")
    password = os.getenv("LINKEDIN_PASSWORD")

    if not email or not password:
        print("  Error: Credenciales de LinkedIn no encontradas en el .env")
        return False

    try:
        print("  Intentando login automático en LinkedIn...")
        await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
        
        # AÑADIDO .first PARA EVITAR STRICT MODE VIOLATION
        await page.locator("input[name='session_key']").first.fill(email)
        await page.locator("input[name='session_password']").first.fill(password)
        await page.locator("button[type='submit']").first.click()
        
        # Esperamos a ver la barra de navegación que confirma que estamos dentro
        await page.wait_for_selector(".global-nav", timeout=15000)
        
        # Guardamos el estado
        await page.context.storage_state(path=COOKIES_PATH)
        print("  Login exitoso y cookies.json generado.")
        return True
    except Exception as e:
        print(f"  Fallo en el login automático: {str(e)}")
        return False


async def download_and_read_pdf(page):
    """
    Interactúa con el perfil para bajar el PDF y extraer el texto.
    """
    try:
        # Clic en el botón de los tres puntos (...)
        more_btn = page.locator("button[aria-label*='Más'], button[aria-label*='More'], .pvs-profile-actions__action button").first
        await more_btn.wait_for(state="visible", timeout=10000)
        await more_btn.click()
        await asyncio.sleep(1) # Pausa para renderizado del menú

        # Clic en 'Guardar en PDF'
        async with page.expect_download() as download_info:
            await page.get_by_text("Guardar en PDF").click()
        
        download = await download_info.value
        pdf_bytes = await download.read_as_bytes()
        
        # Leer el PDF desde memoria usando pypdf
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for pdf_page in reader.pages:
            content = pdf_page.extract_text()
            if content:
                text += content + "\n"
        
        return text
    except Exception as e:
        print(f"  Error al procesar el PDF: {e}")
        return None


async def parse_with_groq(text_content: str):
    """
    Usa Groq para convertir el texto sucio del PDF en un JSON limpio.
    """
    print("  Procesando perfil con Groq...")
    prompt = (
        "Analiza el siguiente texto extraído de un perfil de LinkedIn y devuelve un JSON estricto "
        "con los campos: 'full_name', 'education' (lista de objetos con 'degree', 'institution', 'dates') "
        "y 'experience'. No añadas texto extra, solo el JSON.\n\n"
        f"CONTENIDO DEL PDF:\n{text_content}"
    )
    
    try:
        response = await llm.ainvoke(prompt)
        return response.content
    except Exception as e:
        print(f"  Error en Groq: {e}")
        return None


async def extract_with_agent(profile_url: str, location: str, headless: bool = False):
    """
    Función principal llamada por el orquestador.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        
        if os.path.exists(COOKIES_PATH):
            context = await browser.new_context(storage_state=COOKIES_PATH)
        else:
            context = await browser.new_context()

        page = await context.new_page()

        try:
            print(f" 🔍 Accediendo a: {profile_url}")
            await page.goto(profile_url, wait_until="domcontentloaded")
            await asyncio.sleep(2) # Pausa para que el DOM se asiente

            # COMPROBACIÓN ROBUSTA: ¿Existe la barra de navegación?
            is_logged_in = await page.locator(".global-nav").first.is_visible()

            if not is_logged_in:
                print(" 🛑 LinkedIn detectó que no estamos logueados.")
                if not await login_to_linkedin(page):
                    await browser.close()
                    return None
                
                print(" ⏳ Login completado. Reiniciando entorno para evitar el bloqueo del feed...")
                # EL TRUCO: Cerramos el contexto atascado
                await context.close() 
                
                # Abrimos un contexto nuevo usando el archivo cookies.json recién creado
                context = await browser.new_context(storage_state=COOKIES_PATH)
                page = await context.new_page()
                
                print(f" 🔄 Cargando el perfil en una pestaña limpia: {profile_url}")
                await page.goto(profile_url, wait_until="domcontentloaded")
                await asyncio.sleep(3)

            # 1. Obtener texto del PDF
            raw_text = await download_and_read_pdf(page)
            
            if not raw_text:
                return None

            # 2. IA procesa el texto
            structured_data = await parse_with_groq(raw_text)
            
            print(f" ✅ Candidato extraído correctamente.")
            return structured_data

        finally:
            await browser.close()