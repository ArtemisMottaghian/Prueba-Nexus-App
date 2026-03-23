from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import JobOffer, OfferStatus

# Funcion para obtener el listado (Dashboard y Pantalla de Vacantes)
async def get_vacancies_list(db: AsyncSession, status: Optional[str] = None) -> List[JobOffer]:
    """
    Obtiene todas las vacantes.
    Si se pasa 'status' (ej: 'detected), filtra por ese estado
    Mapping de estados habituales:
    - 'nuevas' -> OfferStatus.detected
    - 'en contacto' -> OfferStatus.contacted
    - 'en negociacion' -> OfferStatus.negotiating
    """
    try:
        async with AsyncSessionLocal() as session:
            query = select(JobOffer)

            # Filtro si nos pasan un estado
            if status:
                query = query.where(JobOffer.status == status)

            # Ordenamos por las mas recientes primero
            query = query.order_by(JobOffer.published_at.desc())

            result = await session.execute(query)

            return result.scalars().all()
    except Exception as e:
        # En caso de error, se relanza la excepcion para que la maneje el controlador
        raise e

# Funcion para obtener el detalle de una vacante
async def get_vacancy_by_id(db: AsyncSession, vacancy_id: int) -> Optional[JobOffer]:
    try:
        async with AsyncSessionLocal() as session:
            # Buscar por id
            query = select(JobOffer).where(JobOffer.id == vacancy_id)

            result = await session.execute(query)

            # Devuelve el objeto o None si no existe
            return result.scalar_one_or_none()
    except Exception as e:
        raise e