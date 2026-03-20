import asyncpg
from app.db.config import settings

async def get_db_connection():
    return await asyncpg.connect(
        host=settings.DB_HOST,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        port=settings.DB_PORT
    )