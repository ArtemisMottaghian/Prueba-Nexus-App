from fastapi import APIRouter, HTTPException
from schemas.services_schemas import NewUser 

from services.users_service import crear_usuario, obtener_usuario_email 


router = APIRouter() 
# --------------------
# CREAr usuario
# POST /api/usuarios
# -----------------

@router.post("")
def endpoint_crear_usuario(datos_cliente: NewUser):
    nuevo_user = crear_usuario(
        email=datos_cliente.email, 
        password_hash=datos_cliente.password_hash, 
        rol=datos_cliente.role
    )
    
    if not nuevo_user:
        raise HTTPException(status_code=400, detail="Error al guardar en la base de datos")
        
    return nuevo_user 


# ------------------
# Obtener usuario por email
# GET /api/usuarios/{email} 
# -----------------
@router.get("/{email}")
def endpoint_obtener_usuario(email: str):
    usuario = obtener_usuario_email(email)
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    return usuario