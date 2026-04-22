from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.candidates_model import Candidate
from sqlalchemy import func

async def upsert_scraped_candidate(db: AsyncSession, data: dict):
    """
    Inserta un nuevo candidato en la base de datos.
    Si el email ya existe, actualiza los registros para evitar duplicados.
    Si el scraper no obtiene un email, genera uno ficticio estructurado.
    """
    if not data:
        print("Error: No se recibieron datos para guardar en la BD.")
        return False
        
    email = data.get("email")
    if not email:
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        
        full_name_clean = f"{first_name}{last_name}".replace(" ", "").lower()
        if not full_name_clean:
            full_name_clean = "candidato_desconocido"
            
        email = f"{full_name_clean}@scraping.local"
        print(f"Aviso: El candidato no tenia email. Generando email estructurado: {email}")

    try:
        print(f"Intentando guardar a {data.get('first_name', 'Desconocido')} en la BD...")
        
        stmt = insert(Candidate).values(
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            email=email,
            phone=data.get("phone"),
            location=data.get("location"),
            source=data.get("source"),
            experience=data.get("experience"),
            candidate_url=data.get("candidate_url"), 
            cv_url=data.get("cv_url"),
            skills=data.get("skills"),
            status=data.get("status", "active"),
            notes=data.get("notes"),
            updated_at=func.now()
        )
        
        on_conflict_stmt = stmt.on_conflict_do_update(
            index_elements=['email'],
            set_={
                "first_name": stmt.excluded.first_name,
                "last_name": stmt.excluded.last_name,
                "phone": stmt.excluded.phone,
                "location": stmt.excluded.location,
                "source": stmt.excluded.source,
                "experience": stmt.excluded.experience,
                "candidate_url": stmt.excluded.candidate_url,
                "skills": stmt.excluded.skills,
                "notes": stmt.excluded.notes,
                "updated_at": func.now()
            }
        )

        await db.execute(on_conflict_stmt)
        await db.commit()
        print(f"Guardado/Actualizado correctamente: {email}")
        return True

    except Exception as e:
        await db.rollback()
        print(f"Error critico al guardar en la BD para {email}: {str(e)}\n")
        return False
    