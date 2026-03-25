from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException

from app.models.clients_model import Client
from app.schemas.clients_schemas import ClientUpdate

async def update_client(db: AsyncSession, client_id: int, client_data: ClientUpdate) -> Client:
    try:
        result = await db.execute(select(Client).where(Client.id == client_id))
        client = result.scalars().first()

        if not client:
            raise HTTPException(
                status_code=404,
                detail=f"Cliente con ID {client_id} no encontrado"
            )
        
        # Extraer todos los datos que el usuario realmente envio
        # exclude_unset=True es clave aquí para no sobreescribir con None los campos no enviados
        update_data = client_data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(client, key, value)

        await db.commit()
        await db.refresh(client)

        return client
    
    except HTTPException:
        # Se relanza la excepcion 404 para que FastAPI la devuelva correctamente
        raise

    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error de SQLAlchemy al actualizar el cliente: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error interno al procesar la actualizacion en la base de datos"
        )
    
    except Exception as e:
        await db.rollback()
        print(f"Error inesperado al actualizar el cliente: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error inesperado en el servidor"
        )