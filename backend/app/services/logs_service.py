from typing import List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.error_log_model import ErrorLog

async def get_all_logs(db: AsyncSession, only_pending: bool = False) -> List[ErrorLog]:
    """Obtiene todos los logs, opcionalmente solo los pendientes."""
    try:
        query = select(ErrorLog)
        if only_pending:
            query = query.where(ErrorLog.is_resolved == False)
        query = query.order_by(ErrorLog.occurred_at.desc())
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise e

async def resolve_log(db: AsyncSession, log_id: int) -> Optional[ErrorLog]:
    """Marca un error como resuelto."""
    try:
        query = select(ErrorLog).where(ErrorLog.id == log_id)
        result = await db.execute(query)
        log = result.scalar_one_or_none()
        if log:
            log.is_resolved = True
            await db.commit()
        return log
    except Exception as e:
        raise e

async def delete_log(db: AsyncSession, log_id: int) -> bool:
    """Elimina un log por su ID."""
    try:
        query = select(ErrorLog).where(ErrorLog.id == log_id)
        result = await db.execute(query)
        log = result.scalar_one_or_none()
        if log:
            await db.delete(log)
            await db.commit()
            return True
        return False
    except Exception as e:
        raise e

if __name__ == "__main__":
    import asyncio
    from app.db.session import AsyncSessionLocal

    async def test():
        try:
            async with AsyncSessionLocal() as db:
                print("🧪 Test 1 — Obtener todos los logs...")
                logs = await get_all_logs(db)
                print(f"✅ Total logs: {len(logs)}")

                print("🧪 Test 2 — Obtener solo pendientes...")
                pending = await get_all_logs(db, only_pending=True)
                print(f"✅ Total pendientes: {len(pending)}")
        except Exception as e:
            print(f"❌ Error: {e}")

    asyncio.run(test())