from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from typing import List

from app.models.clients_model import Client
from app.models.contacts_model import Contact
from app.models.job_model import JobOffer
from app.schemas.clients_schemas import ClientUpdate, ClientOut

# --- Funciones helper ----
async def _get_primary_contact(db: AsyncSession, client_id: int) -> Contact | None:
    """ Devuelve el primer contacto vinculado al cliente, si existe"""
    result = await db.execute(
        select(Contact)
        .where(Contact.client_id == client_id)
        .order_by(Contact.id.asc())
        .limit(1)
    )
    return result.scalars().first()

def _build_client_out(client: Client, contact: Contact | None, vacantes_abiertas: int) -> dict:
    """ Construye el dict de salida combinando Client + Contact."""
    return {
        "id": client.id,
        "nombre": client.company_name,
        "sector": client.sector,
        "contacto_principal": contact.full_name if contact else None,
        "email": contact.email if contact else None,
        "telefono": contact.phone if contact else None,
        "cif": client.cif,
        "direccion": client.direction,
    }


# ---- CRUD -----
async def get_all_clients(db: AsyncSession) -> List[ClientOut]:
    try:
        result = await db.execute(select(Client).order_by(Client.id.asc()))
        clients = result.scalars().all()

        output = []

        for client in clients:
            contact = await _get_primary_contact(db, client.id)
            data = await _build_client_out(client, contact, 0)  # Provide vacantes_abiertas if needed
            output.append(ClientOut(**data))
        
        return output
    except SQLAlchemyError as e:
        print(f"Error al obtener clientes: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener el listado de clientes")
    
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