from fastapi import FastAPI
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.main_router import api_router

from app.db.session import engine
from app.db.connection import Base

# Inicializacion
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"], 
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