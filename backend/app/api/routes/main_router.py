from fastapi import APIRouter

from . import users_route, vacancies_router, metrics_router, clients_router, candidates_router

api_router = APIRouter()

api_router.include_router(users_route.router, prefix="/users", tags=["Gestión de Usuarios"])
api_router.include_router(vacancies_router.router, prefix="/vacancies", tags=["Gestión de Vacantes"])
api_router.include_router(metrics_router.router, prefix="/metrics", tags=["Métricas"])
api_router.include_router(clients_router.router, prefix="/clients", tags=["Gestion de clientes"])
api_router.include_router(candidates_router.router, prefix="/candidates", tags=["Gestion de candidatos"])