from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.candidates_model import CandidateComment
from app.schemas.comments_schemas import CommentCreate
from app.models.companies_model import CompanyComment

# candidatos
# Crear comentario
async def add_candidate_comment(db: AsyncSession, candidate_id: int, data: CommentCreate,user_id: int):
    new_comment = CandidateComment(
        candidate_id=candidate_id,
        user_id=user_id,
        comment=data.comment
    )
    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)
    return new_comment

#actualizar comentario
async def update_candidate_comment(db: AsyncSession, comment_id: int, new_text: str):
    result = await db.execute(select(CandidateComment).where(CandidateComment.id == comment_id))
    comment = result.scalars().first()
    
    if comment:
        comment.comment = new_text
        await db.commit()
        await db.refresh(comment)
    return comment

#obtener comentarios
async def get_candidate_comments(db: AsyncSession, candidate_id: int):
    # Buscamos los comentarios del candidato y los ordenamos del más nuevo al más viejo
    query = select(CandidateComment).where(
        CandidateComment.candidate_id == candidate_id
    ).order_by(CandidateComment.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()



# Empresas
# Crear comentario
async def add_company_comment(db: AsyncSession, company_id: int, data: CommentCreate, user_id: int):
    new_comment = CompanyComment(
        company_id=company_id,
        user_id=user_id,
        comment=data.comment
    )
    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)
    return new_comment

# Actualizar comentario
async def update_company_comment(db: AsyncSession, comment_id: int, new_text: str):
    result = await db.execute(select(CompanyComment).where(CompanyComment.id == comment_id))
    comment = result.scalars().first()
    if comment:
        comment.comment = new_text
        await db.commit()
        await db.refresh(comment)
    return comment

# Obtener comentarios
async def get_company_comments(db: AsyncSession, company_id: int):
    query = select(CompanyComment).where(CompanyComment.company_id == company_id).order_by(CompanyComment.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

# Eliminar comentario
async def delete_company_comment(db: AsyncSession, comment_id: int):
    result = await db.execute(select(CompanyComment).where(CompanyComment.id == comment_id))
    comment = result.scalars().first()
    if not comment:
        return False
    await db.delete(comment)
    await db.commit()
    return True

