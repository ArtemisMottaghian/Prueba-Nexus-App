from fastapi import FastAPI
import uvicorn
from app.api.routes.main_router import api_router

# Inicializacion
app = FastAPI()

# Al iniciar
@app.on_event("startup")
def arrancar_servidor():
    print("Iniciando ")

app.include_router(api_router, prefix="/api")

# endpoint prueba
@app.get("/")
def ruta_raiz():
    return {"estado": "ok", "mensaje": "El servidor de Nexus App está vivo"}

#conexion y puerto
if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)