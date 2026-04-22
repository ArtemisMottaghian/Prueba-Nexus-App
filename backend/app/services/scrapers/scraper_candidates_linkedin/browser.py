import os
import random
from playwright.async_api import async_playwright
from dotenv import load_dotenv

# Forzamos la lectura del archivo .env
load_dotenv()

# Lista de User-Agents actualizados para rotar
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36",
]

async def get_browser_context(headless: bool = False):
    """
    Inicializa y configura una instancia del navegador utilizando Playwright.
    Aplica configuraciones para simular un entorno humano e inyecta la cookie de sesión.
    """
    print("Iniciando navegador con IP directa (sin proxy configurado)")

    try:
        pw = await async_playwright().start()

        browser = await pw.chromium.launch(
            headless = headless,
            args = [
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process", 
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )

        selected_user_agent = random.choice(USER_AGENTS)

        context = await browser.new_context(
            user_agent = selected_user_agent,
            viewport = {"width": 1920, "height": 1080}
        )

        li_at_cookie = os.getenv("LINKEDIN_SESSION_COOKIE")

        if li_at_cookie and li_at_cookie != "dummy_cookie":
            await context.add_cookies([{
                'name': 'li_at',
                'value': li_at_cookie,
                'domain': '.linkedin.com',
                'path': '/'
            }])
            print("Cookie de LinkedIn inyectada correctamente")
        else:
            print("El script no está encontrando tu cookie en el .env")

        return pw, browser, context
    except Exception as e:
        print(f"Error al inicializar el navegador: {e}")
        return None, None, None
    