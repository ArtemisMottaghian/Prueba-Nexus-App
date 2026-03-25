from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from typing import List

from app.models.clients_model import Client
from app.models.contacts_model import Contact      # asegúrate de tener este modelo
from app.models.job_model import JobOffer   # asegúrate de tener este modelo
from app.schemas.clients_schemas import (
    ClientCreate, ClientUpdate, ClientOut, ClientDetailOut, VacanteOut
)
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

async def _get_client_or_404(db: AsyncSession, client_id: int) -> Client:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail=f"Cliente con ID {client_id} no encontrado"
        )
    return client

# ---- CRUD -----

async def create_client(db: AsyncSession, client_data: ClientCreate) -> ClientOut:
    try:
        new_client = Client(
            company_name = client_data.nombre,
            sector=client_data.sector,
            cif=client_data.cif,
            direccion=client_data.direccion,
        )
        db.add(new_client)
        await db.flush() # Se obtiene el id sin hacer commit aun

        # Si viene info del contacto, crear el registro en contacts
        contact = None
        if any([client_data.contacto_principal, client_data.email, client_data.telefono]):
            contact = Contact(
                client_id=new_client.id,
                full_name=client_data.contacto_principal or "Sin nombre",
                email=client_data.email,
                phone=client_data.telefono,
            )
            db.add(contact)
        await db.commit()
        await db.refresh(new_client)

        data = _build_client_out(new_client, contact)
        return ClientOut(**data)
    
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al crar cliente: {e}")
        raise HTTPException(status_code=500, detail="Error al crear el cliente")


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

async def get_client_by_id(db: AsyncSession, client_id: int) -> ClientDetailOut:
    try:
        client = await _get_client_or_404(db, client_id)
        contact = await _get_primary_contact(db, client_id)

        # Vacantes vinculadas al cliente
        vacantes_result = await db.execute(
            select(JobOffer).where(
                JobOffer.id == client.original_offer_id
            )
        )
        vacantes_raw = vacantes_result.scalars().all()

        vacantes = [
            VacanteOut(
                id=v.title,
                estado=v.status.value if v.status else "unkown",
                fecha=v.published_at
            )
            for v in vacantes_raw
        ]

        data = _build_client_out(client, contact, vacantes_abiertas=len(vacantes))
        return ClientDetailOut(**data, vacantes=vacantes)
    
    except HTTPException:
        raise

    except SQLAlchemyError as e:
        print(f"Error al obtener el cliente {client_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener el cliente")
    
    except Exception as e:
        print(f"Error inesperado al listar el cliente {client_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error inesperado en el servidor"
        )
    
async def delete_client(db: AsyncSession, client_id: int) -> dict:
    try:
        client = await _get_client_or_404(db, client_id)

        # Los contactos tienen ON DELETE CASCADE en la DB, pero por claridad
        await db.execute(delete(Contact).where(Contact.client_id == client_id))
        await db.delete(client)
        await db.commit()

        return {"mensaje": "Cliente eliminado correctamente"}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al eliminar el cliente {client_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar el cliente")

async def update_client(db: AsyncSession, client_id: int, client_data: ClientUpdate) -> ClientOut:
    try:
        client = await _get_client_or_404(db, client_id)
        if not client:
            raise HTTPException(
                status_code=404,
                detail=f"Cliente con ID {client_id} no encontrado"
            )
        
        # Extraer todos los datos que el usuario realmente envio
        # exclude_unset=True es clave aquí para no sobreescribir con None los campos no enviados
        update_data = client_data.model_dump(exclude_unset=True)

        # Campos que van al modelo Contact
        contact_fields = {"contacto_principal", "email", "telefono"}
        contact_updates = {k: v for k, v in update_data.items() if k in contact_fields}

        contact = await _get_primary_contact(db, client_id)

        if contact_updates:
            if contact:
                # Actualizar el contacto existente
                if "contacto_principal" in contact_updates:
                    contact.full_name = contact_updates["contacto_principal"]
                if "email" in contact_updates:
                    contact.email = contact_updates["email"]
                if "telefono" in contact_updates:
                    contact.phone = contact_updates["telefono"]
            else:
                # Crear contacto si no existia
                contact = Contact(
                    client_id=client_id,
                    full_name=contact_updates.get("contacto_principal", "Sin nombre"),
                    email=contact_updates.get("email"),
                    phone=contact_updates.get("telefono")
                )
                db.add(contact)
        
        await db.commit()
        await db.refresh(client)

        data = _build_client_out(client, contact)
        return ClientOut(**data)
    
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

async def get_client_vacantes(db: AsyncSession, client_id: int) -> List[VacanteOut]:
    try:
        await _get_client_or_404(db, client_id)

        result = await db.execute(
            select(JobOffer).where(JobOffer.id == (
                select(Client.original_offer_id).where(Client.id == client_id).scalar_subquery()
            ))
        )

        vacantes_raw = result.scalars().all()

        return [
            VacanteOut(
                id=v.id,
                titulo=v.title,
                estado=v.status.value if v.status else "unknown",
                fecha=v.published_at,
            )
            for v in vacantes_raw
        ]
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        print(f"Error al obtener vacantes del cliente {client_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener vacantes")