import asyncio
from backend.app.core.scraper_candidates_linkedin_config import (
    KEYWORDS,
    SECTORS,
    LOCATIONS,
    HEADLESS_MODE,
)
from backend.app.services.scrapers.scraper_empleados_linkedin.runner import run_scraper
from backend.app.services.scrapers.scraper_github.runner import run_github_scraper
from backend.app.services.scrapers.scraper_pdf_google.runner import run_pdf_scraper


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