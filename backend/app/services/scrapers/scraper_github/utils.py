from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.candidates_model import Candidate
from sqlalchemy import func

async def candidate_exists(db: AsyncSession, email: str) -> bool:
    """Consulta rápida a la BD para evitar duplicados."""
    stmt = select(Candidate).where(Candidate.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None

async def upsert_scraped_candidate(db: AsyncSession, data: dict):
    """
    Inserta o actualiza un candidato.
    Solo devuelve True si es un candidato NUEVO o si se ha AÑADIDO información nueva.
    Devuelve False si el candidato ya existía y los datos son idénticos.
    """
    try:
        stmt = select(Candidate).where(Candidate.email == data.get("email"))
        result = await db.execute(stmt)
        existing_candidate = result.scalar_one_or_none()

        if existing_candidate:
            hay_cambios = False

            # 1. Fusión de URLs de perfiles (LinkedIn, Portfolio)
            nueva_url = data.get("candidate_url")
            if nueva_url:
                url_actual = existing_candidate.candidate_url or ""
                # Solo cogemos los links que no estén ya en la base de datos
                links_nuevos = [link.strip() for link in nueva_url.split('|') if link.strip() and link.strip() not in url_actual]
                if links_nuevos:
                    separador = " | " if url_actual else ""
                    existing_candidate.candidate_url = f"{url_actual}{separador}{' | '.join(links_nuevos)}"
                    hay_cambios = True

            # 2. Fusión de Skills
            nuevas_skills = data.get("skills")
            if nuevas_skills:
                skills_actuales = existing_candidate.skills or ""
                skills_nuevas_lista = [s.strip() for s in nuevas_skills.split('|') if s.strip() and s.strip() not in skills_actuales]
                if skills_nuevas_lista:
                    separador = " | " if skills_actuales else ""
                    existing_candidate.skills = f"{skills_actuales}{separador}{' | '.join(skills_nuevas_lista)}"
                    hay_cambios = True

            # 3. Fusión de CV/GitHub URL
            nuevo_cv = data.get("cv_url")
            if nuevo_cv:
                cv_actual = existing_candidate.cv_url or ""
                if nuevo_cv not in cv_actual:
                    separador = " | " if cv_actual else ""
                    existing_candidate.cv_url = f"{cv_actual}{separador}{nuevo_cv}"
                    hay_cambios = True

            # 4. Fusión de Experiencia (Bio de GitHub)
            nueva_exp = data.get("experience")
            if nueva_exp:
                exp_actual = existing_candidate.experience or ""
                if nueva_exp not in exp_actual:
                    separador = "\n\n--- NUEVA EXPERIENCIA --- \n" if exp_actual else ""
                    existing_candidate.experience = f"{exp_actual}{separador}{nueva_exp}"
                    hay_cambios = True

            # 5. Teléfono
            if data.get("phone") and not existing_candidate.phone:
                existing_candidate.phone = data.get("phone")
                hay_cambios = True

            # EVALUACIÓN FINAL
            if hay_cambios:
                existing_candidate.updated_at = func.now()
                await db.commit()
                return True # Hubo cambios reales, el contador del main sumará 1.
            
            return False # Era idéntico, no hacemos nada. El contador NO sumará.

        else:
            # Creación de nuevo registro si no existe el email
            nuevo_candidato = Candidate(
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
                status=data.get("status", "active")
            )
            db.add(nuevo_candidato)
            await db.commit()
            return True # Es nuevo, el contador del main sumará 1.

    except Exception as e:
        await db.rollback()
        print(f"Error en persistencia BD: {str(e)}")
        return False