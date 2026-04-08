from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi import HTTPException

from app.models.user_model import User
from app.schemas.users_schemas import NewUser, UserUpdate
from app.core.security import hash_password
from typing import Optional

#Crear nuevo usuario
async def newUser(db: AsyncSession, datos: NewUser):
    try:
        datos_dict = datos.model_dump()

        # Se extrae la contraseña plana y se hashea
        plain_password = datos_dict.pop('password')
        hashed_pasword = hash_password(plain_password)

        # Se asigna la contraseña hasheada al diccionario
        datos_dict['password_hash'] = hashed_pasword

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

async def update_user(db: AsyncSession, email: str, datos: UserUpdate) -> Optional[User]:
    try:
        usuario = await getUser(db, email)
        if not usuario:
            return None

        update_data = datos.model_dump(exclude_unset=True)

        # Si viene contraseña nueva, hashearla
        if "password" in update_data:
            update_data["password_hash"] = hash_password(update_data.pop("password"))

        for field, value in update_data.items():
            setattr(usuario, field, value)

        await db.commit()
        await db.refresh(usuario)
        return usuario

    except SQLAlchemyError as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar el usuario")

async def delete_user(db: AsyncSession, email: str) -> bool:
    try:
        usuario = await getUser(db, email)
        if not usuario:
            return False

        await db.delete(usuario)
        await db.commit()
        return True

    except SQLAlchemyError as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Error al eliminar el usuario")