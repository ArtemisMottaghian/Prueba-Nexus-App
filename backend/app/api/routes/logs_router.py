from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.connection import get_db
from app.services import logs_service
from app.schemas.logs_schemas import ErrorLogResponse, ErrorLogResolve, ErrorLogList

router = APIRouter(tags=["Logs / Auditoría"])

@router.get("/", response_model=ErrorLogList)
async def get_logs(
    only_pending: bool = Query(False, description="Si es True, devuelve solo los errores sin resolver"),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene todos los logs de error del sistema."""
    logs = await logs_service.get_all_logs(db, only_pending=only_pending)
    return {"total": len(logs), "errors": logs}

@router.patch("/{log_id}/resolve", response_model=ErrorLogResponse)
async def resolve_log(
    log_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Marca un error como resuelto."""
    log = await logs_service.resolve_log(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log no encontrado")
    return log

@router.delete("/{log_id}")
async def delete_log(
    log_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Elimina un log por su ID."""
    deleted = await logs_service.delete_log(db, log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Log no encontrado")
    return {"message": "Log eliminado correctamente"}