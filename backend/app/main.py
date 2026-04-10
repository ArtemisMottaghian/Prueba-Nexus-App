from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.main_router import api_router
from app.core.config import settings
from app.db.session import engine
from app.db.connection import Base

import uvicorn
import os
import app.models


# Inicializacion
ENV = os.getenv("ENV", "development")

app = FastAPI(
    docs_url="/docs" if ENV != "production" else None,
    redoc_url="/redoc" if ENV != "production" else None,
    openapi_url="/openapi.json" if ENV != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        #server
        "http://nexus.ara-tech.es",
        "https://nexus.ara-tech.es",
        f"http://{settings.SERVER_IP}",         
        f"http://{settings.SERVER_IP}:5173",
        #https
        f"https://{settings.SERVER_IP}",         
        f"https://{settings.SERVER_IP}:5173",
        
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