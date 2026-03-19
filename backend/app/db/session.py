from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.db.config import settings # Importamos la config desde dentro de db/
from typing import AsyncGenerator

# Motor asyncrono
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False, #Pon en True para ver SQL en consola
    future=True, # Usa caracteristicas futuras de SQLAlchemy 2.0
    pool_pre_ping=True, # Verifica conexion antes de usarla
    pool_size=20, # Numero de conexion en el pool
    max_overflow=10 # Conexiones extra permitidas temporalmente
)

# Creacion de sesiones
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False, # Evita errores al acceder atributos despues del commit
    autoflush=False
)

# Usar esto en las rutas: db: AsyncSession = Depends(get_db)
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()