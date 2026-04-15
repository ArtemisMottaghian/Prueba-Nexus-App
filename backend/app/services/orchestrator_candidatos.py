import asyncio
from app.core.scraper_linkedin_candidatos_config import (
    KEYWORDS,
    SECTORS,
    LOCATIONS,
    HEADLESS_MODE,
)
from app.services.scrapers.scraper_empleados_linkedin.main import run_scraper
from app.services.scrapers.scraper_github.main_github import run_github_scraper
from app.services.scrapers.scraper_pdf_google.main_pdf_google import run_pdf_scraper


async def run_candidate_scrapers():
    print("\n========================================")
    print("  ORQUESTADOR DE CANDIDATOS - INICIO")
    print("========================================\n")

    # --- 1. LinkedIn Candidatos ---
    print("[ 1/3 ] Iniciando scraper LinkedIn candidatos...")
    try:
        await run_scraper(
            keywords=KEYWORDS,
            sectors=SECTORS,
            locations=LOCATIONS,
            headless=HEADLESS_MODE,
        )
        print("[ 1/3 ] LinkedIn candidatos completado ✅\n")
    except Exception as e:
        print(f"[ 1/3 ] Error en LinkedIn candidatos ❌: {e}\n")

    # --- 2. GitHub ---
    print("[ 2/3 ] Iniciando scraper GitHub...")
    try:
        await run_github_scraper()
        print("[ 2/3 ] GitHub completado ✅\n")
    except Exception as e:
        print(f"[ 2/3 ] Error en GitHub ❌: {e}\n")

    # --- 3. Google PDFs ---
    print("[ 3/3 ] Iniciando scraper Google PDFs (CVs)...")
    try:
        await run_pdf_scraper()
        print("[ 3/3 ] Google PDFs completado ✅\n")
    except Exception as e:
        print(f"[ 3/3 ] Error en Google PDFs ❌: {e}\n")

    print("========================================")
    print("  ORQUESTADOR DE CANDIDATOS - FIN")
    print("========================================\n")


if __name__ == "__main__":
    asyncio.run(run_candidate_scrapers())