from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.db.base import Base
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,       # conexiones permanentes en el pool
    max_overflow=20,    # conexiones adicionales bajo pico de carga
    pool_timeout=30,    # segundos esperando conexión libre antes de error
    pool_pre_ping=True, # verifica conexión antes de usarla (evita stale connections)
    pool_recycle=3600,  # recicla conexiones cada hora
)

# Creador de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
