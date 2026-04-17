from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.candidates_model import Candidate
from sqlalchemy import func

async def upsert_scraped_candidate(db: AsyncSession, data: dict) -> bool:
    """
    Inserta un nuevo candidato en la BBDD. Si el email existe, se actualiza.
    Devuelve True si el proceso tiene éxito, False si hay un error.
    """
    try:
        print(f"Intentando guardar a {data.get('first_name')} en la BD")
        
        # 1. Guardar los datos en PostgreSQL
        stmt = insert(Candidate).values(
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            email=data.get("email"),
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
        
        # 2. El UPDATE del conflicto
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

        # 3. Ejecutamos la consulta y hacemos commit
        await db.execute(on_conflict_stmt)
        await db.commit()
        return True

    except Exception as e:
        # Si algo falla hacemos un rollback para no dejar la BD colgada
        await db.rollback()
        print(f"Error al guardar en la BD: {str(e)}\n")
        return False