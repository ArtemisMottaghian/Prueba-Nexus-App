from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.user_model import User
from schemas.services_schemas import NewUser

async def newUser(db: AsyncSession, datos: NewUser):
    datos_dict = datos.model_dump()
    datos_dict["role"] = datos.role.value 
    
    db_user = User(**datos_dict)
    
    db.add(db_user)
    await db.commit() 
    await db.refresh(db_user) 
    
    return db_user

async def getUser(db: AsyncSession, email: str):
    resultado = await db.execute(select(User).where(User.email == email))
    
    return resultado.scalars().first()