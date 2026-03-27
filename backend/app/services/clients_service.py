from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from typing import List

from app.models.clients_model import Client
from app.models.contacts_model import Contact
from app.models.job_model import JobOffer
from app.schemas.clients_schemas import (
    ClientCreate, ClientUpdate, ClientOut, ClientDetailOut, VacancyOut
)


# ── Helper ──────────────────────────────────────────────────────────────────

async def _get_client_or_404(db: AsyncSession, client_id: int) -> Client:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail=f"Client with ID {client_id} not found"
        )
    return client


async def _get_primary_contact(db: AsyncSession, client_id: int) -> Contact | None:
    """Devuelve el primer contacto vinculado al cliente, si existe."""
    result = await db.execute(
        select(Contact)
        .where(Contact.client_id == client_id)
        .order_by(Contact.id.asc())
        .limit(1)
    )
    return result.scalars().first()


def _build_client_out(client: Client, contact: Contact | None, open_positions: int = 0) -> dict:
    """Construye el dict de salida combinando Client + Contact."""
    return {
        "id": client.id,
        "company_name": client.company_name,
        "sector": client.sector,
        "primary_contact": contact.full_name if contact else None,
        "email": contact.email if contact else None,
        "phone": contact.phone if contact else None,
        "open_positions": open_positions,
        "cif": client.cif,
        "address": client.address,
    }


# ── CRUD ─────────────────────────────────────────────────────────────────────

async def get_all_clients(db: AsyncSession) -> List[ClientOut]:
    try:
        result = await db.execute(select(Client).order_by(Client.id.asc()))
        clients = result.scalars().all()

        output = []
        for client in clients:
            contact = await _get_primary_contact(db, client.id)
            data = _build_client_out(client, contact)
            output.append(ClientOut(**data))

        return output

    except SQLAlchemyError as e:
        print(f"Error al obtener clientes: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving client list")


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

        positions = [
            VacancyOut(
                id=v.id,
                title=v.title,
                status=v.status.value if v.status else "unknown",
                date=v.published_at,
            )
            for v in vacantes_raw
        ]

        data = _build_client_out(client, contact, open_positions=len(positions))
        return ClientDetailOut(**data, positions=positions)

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        print(f"Error al obtener cliente {client_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving client")


async def create_client(db: AsyncSession, client_data: ClientCreate) -> ClientOut:
    try:
        # 1. Crear el cliente
        new_client = Client(
            company_name=client_data.company_name,
            sector=client_data.sector,
            cif=client_data.cif,
            address=client_data.address,
        )
        db.add(new_client)
        await db.flush()  # Obtenemos el ID sin hacer commit aún

        # 2. Si viene info de contacto, crear el registro en contacts
        contact = None
        if any([client_data.primary_contact, client_data.email, client_data.phone]):
            contact = Contact(
                client_id=new_client.id,
                full_name=client_data.primary_contact or "Unknown",
                email=client_data.email,
                phone=client_data.phone,
            )
            db.add(contact)

        await db.commit()
        await db.refresh(new_client)

        data = _build_client_out(new_client, contact)
        return ClientOut(**data)

    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al crear cliente: {e}")
        raise HTTPException(status_code=500, detail="Error creating client")


async def update_client(db: AsyncSession, client_id: int, client_data: ClientUpdate) -> ClientOut:
    try:
        client = await _get_client_or_404(db, client_id)
        update_data = client_data.model_dump(exclude_unset=True)

        # Campos que van al modelo Client
        client_fields = {
            "company_name": "company_name",
            "sector": "sector",
            "cif": "cif",
            "address": "address"
        }
        for schema_key, db_key in client_fields.items():
            if schema_key in update_data:
                setattr(client, db_key, update_data[schema_key])

        # Campos que van al modelo Contact
        contact_fields = {"primary_contact", "email", "phone"}
        contact_updates = {k: v for k, v in update_data.items() if k in contact_fields}

        contact = await _get_primary_contact(db, client_id)

        if contact_updates:
            if contact:
                # Actualizar contacto existente
                if "primary_contact" in contact_updates:
                    contact.full_name = contact_updates["primary_contact"]
                if "email" in contact_updates:
                    contact.email = contact_updates["email"]
                if "phone" in contact_updates:
                    contact.phone = contact_updates["phone"]
            else:
                # Crear contacto si no existía
                contact = Contact(
                    client_id=client_id,
                    full_name=contact_updates.get("primary_contact", "Unknown"),
                    email=contact_updates.get("email"),
                    phone=contact_updates.get("phone"),
                )
                db.add(contact)

        await db.commit()
        await db.refresh(client)

        data = _build_client_out(client, contact)
        return ClientOut(**data)

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al actualizar cliente {client_id}: {e}")
        raise HTTPException(status_code=500, detail="Error updating client")


async def delete_client(db: AsyncSession, client_id: int) -> dict:
    try:
        client = await _get_client_or_404(db, client_id)

        # Los contactos tienen ON DELETE CASCADE en la DB, pero por claridad:
        await db.execute(delete(Contact).where(Contact.client_id == client_id))
        await db.delete(client)
        await db.commit()

        return {"message": "Client deleted successfully"}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error al eliminar cliente {client_id}: {e}")
        raise HTTPException(status_code=500, detail="Error deleting client")


async def get_client_positions(db: AsyncSession, client_id: int) -> List[VacancyOut]:
    try:
        await _get_client_or_404(db, client_id)  # Valida que existe

        result = await db.execute(
            select(JobOffer).where(JobOffer.id == (
                select(Client.original_offer_id)
                .where(Client.id == client_id)
                .scalar_subquery()
            ))
        )
        positions_raw = result.scalars().all()

        return [
            VacancyOut(
                id=v.id,
                title=v.title,
                status=v.status.value if v.status else "unknown",
                date=v.published_at,
            )
            for v in positions_raw
        ]

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        print(f"Error al obtener vacantes del cliente {client_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving client positions")