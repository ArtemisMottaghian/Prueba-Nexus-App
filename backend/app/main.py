from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api.routes.main_router import api_router

from app.db.session import engine
from app.db.connection import Base

import app.models
from app.core.config import settings

# Inicializacion
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        #server
        f"{settings.SERVER_IP}",
        
        #local
        "http://localhost:5173",
        "http://localhost:3000",
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Al iniciar
@app.on_event("startup")
async def arrancar_servidor():
    print("Iniciando ")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(api_router, prefix="/api")

# endpoint prueba
@app.get("/")
def ruta_raiz():
    return {"estado": "ok", "mensaje": "El servidor de Nexus App está vivo"}

# conexion y puerto
if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)