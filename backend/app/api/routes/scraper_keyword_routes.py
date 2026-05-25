from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.db.session import AsyncSessionLocal 
from app.models.scraper_keyword_model import ScraperKeyword
from app.schemas.scraper_keyword_schemas import ScraperKeywordCreate, ScraperKeywordResponse

router = APIRouter(prefix="/scraper-config", tags=["Scraper Config"])

@router.post("/", response_model=ScraperKeywordResponse)
async def create_keyword(data: ScraperKeywordCreate):
    async with AsyncSessionLocal() as db:
        new_item = ScraperKeyword(**data.model_dump())
        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)
        return new_item
    
@router.get("/", response_model=list[ScraperKeywordResponse])
async def get_keywords(type: str = None):
    """Obtiene todas las palabras. Si le pasas el parámetro ?type=city filtra por tipo."""
    async with AsyncSessionLocal() as db:
        query = select(ScraperKeyword)
        if type:
            query = query.where(ScraperKeyword.type == type)
            
        result = await db.execute(query)
        return result.scalars().all()
    
@router.patch("/{item_id}/toggle")
async def toggle_keyword_status(item_id: int):
    """Activa o desactiva una palabra clave para que el scraper la use o la ignore."""
    async with AsyncSessionLocal() as db:
        query = select(ScraperKeyword).where(ScraperKeyword.id == item_id)
        result = await db.execute(query)
        item = result.scalar_one_or_none()
        
        if not item:
            raise HTTPException(status_code=404, detail="Item no encontrado")
        
        item.is_active = not item.is_active
        await db.commit()
        return {"message": f"El estado de '{item.keyword}' ahora es: Acttivo={item.is_active}"}