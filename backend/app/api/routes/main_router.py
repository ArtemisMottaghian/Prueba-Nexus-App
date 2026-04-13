from fastapi import APIRouter, Depends
from app.core.jwt import get_current_user

from . import users_route, vacancies_router, metrics_router, clients_router, candidates_router, auth_router,calendar_router, logs_router

api_router = APIRouter()

#------ Rutas publicas
api_router.include_router(auth_router.router, prefix="/login", tags=["Login"] )
api_router.include_router(users_route.router, prefix="/users", tags=["Gestión de Usuarios"])


#------ Rutas con token DESACTIVADAS POR AHORA, SE DEBEN ACTIVAR CUANDO SE SEPA QUE FUNCIONAN BIEN LOS ENDPOINTS
api_router.include_router(vacancies_router.router, prefix="/vacancies", tags=["Gestión de Vacantes"])
api_router.include_router(metrics_router.router, prefix="/metrics", tags=["Métricas"])
api_router.include_router(clients_router.router, prefix="/clients", tags=["Gestion de clientes"])
api_router.include_router(candidates_router.router, prefix="/candidates", tags=["Gestion de candidatos"])
api_router.include_router(calendar_router.router, prefix="/calendar", tags=["Calendario"])
api_router.include_router(logs_router.router, prefix="/logs", tags=["Logs / Auditoría"])

#api_router.include_router(vacancies_router.router, prefix="/vacancies", tags=["Gestión de Vacantes"], dependencies=[Depends(get_current_user)])
#api_router.include_router(metrics_router.router, prefix="/metrics", tags=["Métricas"], dependencies=[Depends(get_current_user)])
#api_router.include_router(clients_router.router, prefix="/clients", tags=["Gestion de clientes"], dependencies=[Depends(get_current_user)])
#api_router.include_router(candidates_router.router, prefix="/candidates", tags=["Gestion de candidatos"], dependencies=[Depends(get_current_user)])