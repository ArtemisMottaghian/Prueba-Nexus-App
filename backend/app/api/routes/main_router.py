from fastapi import APIRouter

from . import users_route

api_router = APIRouter()

api_router.include_router(users_route.router, prefix="/usuarios", tags=["Gestión de Usuarios"])
