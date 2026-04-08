from app.db.session import AsyncSessionLocal
from app.models.error_log_model import ErrorLog

async def log_scraper_error(error_code: str, message: str) -> None:
    try:
        async with AsyncSessionLocal() as session:
            log = ErrorLog(error_code=error_code, message=message)
            session.add(log)
            await session.commit()
    except Exception as e:
        print(f"[LOG FAILED] No se pudo guardar en error_logs: {e}")