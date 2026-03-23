from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi import HTTPException

from models.user_model import User
from schemas.users_schemas import NewUser

#Crear nuevo usuario
async def newUser(db: AsyncSession, datos: NewUser):
    try:
        datos_dict = datos.model_dump()
        db_user = User(**datos_dict)
        
        db.add(db_user)
        await db.commit() 
        await db.refresh(db_user) 
        return db_user

    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail=f"Error de integridad: El usuario ya existe o hay un dato duplicado."
        )
    
    except SQLAlchemyError as e:
        await db.rollback()
        print(f"Error de SQLAlchemy: {e}") 
        raise HTTPException(
            status_code=500, 
            detail="Error interno al procesar la base de datos."
        )
        
    except Exception as e:
        await db.rollback()
        print(f"Error inesperado: {e}")
        raise e
    
#Obtener usuario por email
async def getUser(db: AsyncSession, email: str):
    try:
        resultado = await db.execute(select(User).where(User.email == email))
        return resultado.scalars().first()
    except SQLAlchemyError:
        return None