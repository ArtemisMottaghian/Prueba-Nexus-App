from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.db.connection import get_db

from app.schemas.clients_schemas import ClientUpdate, ClientOut
#from app.services import 

router = APIRouter()
