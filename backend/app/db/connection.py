from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Importamos la variable 'settings' que ya has instanciado en tu config.py
from core.config import settings 

# Creamos el motor asíncrono
engine = create_async_engine(settings.DATABASE_URL, echo=False)

# Creador de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# ==========================================
# AQUÍ ESTÁ EL BASE QUE NO ENCONTRABA
Base = declarative_base()
# ==========================================

# El inyector de dependencias asíncrono
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()