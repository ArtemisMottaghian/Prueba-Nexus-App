import os
from playwright.async_api import async_playwright
from dotenv import load_dotenv
from typing import Tuple, Optional
from playwright.async_api import async_playwright, Playwright, Browser, BrowserContext

# Forzamos la lectura del archivo .env
load_dotenv()

async def get_browser_context(headless: bool = False) -> Tuple[Optional[Playwright], Optional[Browser], Optional[BrowserContext]]:
    # Inicializa el navegador con Playright y le aplica configuraciones para simular un enetorno humano y evitar bloqueos

    try:
        # Iniciamos Playwrigth
        pw = await async_playwright().start()

        # Lanzamos Chromium
        browser = await pw.chromium.launch(
            headless = headless,
            args = ["--disable-blink-features=AutomotionControlled"]
        )

        # Abrimos una ventana de incognito limpia
        # usamos el User-Agent de un navegador real para despistar
        context = await browser.new_context(
            user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )

        li_at_cookie = os.getenv ("LINKEDIN_SESSION_COOKIE")

        if li_at_cookie and li_at_cookie != "dummy_cookie":
            await context.add_cookies([{
                'name': 'li_at',
                'value': li_at_cookie,
                'domain': '.linkedin.com',
                'path': '/'
            }])
            print("Cookie de LinkedIn inyectada correctamente")
        else:
            print("El sript no esta encontrando tu cookie en el .env")

        return pw, browser, context
    except Exception as e:
        print(f"Error al inicializar el navegador: {e}")
        return None, None, None
