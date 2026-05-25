from fastapi import APIRouter, Depends
from app.core.jwt import get_current_user

from . import (
    users_route,
    vacancies_router,
    metrics_router,
    candidates_router,
    auth_router,
    calendar_router,
    logs_router,
    companies_router,
    ai_router,
    emails_router,
    matching_router,
    scraper_keyword_routes,
)

api_router = APIRouter()

# ------ Rutas publicas
api_router.include_router(auth_router.router, prefix="/login", tags=["Login"])
api_router.include_router(
    users_route.router, prefix="/users", tags=["Gestión de Usuarios"]
)


# ------ Rutas con token DESACTIVADAS POR AHORA, SE DEBEN ACTIVAR CUANDO SE SEPA QUE FUNCIONAN BIEN LOS ENDPOINTS
api_router.include_router(
    vacancies_router.router, prefix="/vacancies", tags=["Gestión de Vacantes"]
)
api_router.include_router(metrics_router.router, prefix="/metrics", tags=["Métricas"])
api_router.include_router(
    candidates_router.router, prefix="/candidates", tags=["Gestion de candidatos"]
)
api_router.include_router(
    calendar_router.router, prefix="/calendar", tags=["Calendario"]
)
api_router.include_router(logs_router.router, prefix="/logs", tags=["Logs / Auditoría"])
api_router.include_router(
    companies_router.router, prefix="/companies", tags=["Companies"]
)
api_router.include_router(matching_router.router, prefix="/matching", tags=["Matching"])
api_router.include_router(ai_router.router, prefix="/ai", tags=["AI Match"])
api_router.include_router(emails_router.router, prefix="/emails", tags=["Emails"])

api_router.include_router(scraper_keyword_routes.router)

# api_router.include_router(vacancies_router.router, prefix="/vacancies", tags=["Gestión de Vacantes"], dependencies=[Depends(get_current_user)])
# api_router.include_router(metrics_router.router, prefix="/metrics", tags=["Métricas"], dependencies=[Depends(get_current_user)])
# api_router.include_router(candidates_router.router, prefix="/candidates", tags=["Gestion de candidatos"], dependencies=[Depends(get_current_user)])
