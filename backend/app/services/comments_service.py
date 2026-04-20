from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.candidates_model import CandidateComment 
from app.models.clients_model import ClientComment
from app.schemas.comments_schemas import CommentCreate

# candidatos
# Crear comentario
async def add_candidate_comment(db: AsyncSession, candidate_id: int, data: CommentCreate):
    new_comment = CandidateComment(
        candidate_id=candidate_id,
        user_id=data.user_id,
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

# clientes
# Crear comentario
async def add_client_comment(db: AsyncSession, client_id: int, data: CommentCreate):
    new_comment = ClientComment(
        client_id=client_id,
        user_id=data.user_id,
        comment=data.comment
    )
    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)
    return new_comment

#actualizar comentario
async def update_client_comment(db: AsyncSession, comment_id: int, new_text: str):
    result = await db.execute(select(ClientComment).where(ClientComment.id == comment_id))
    comment = result.scalars().first()
    
    if comment:
        comment.comment = new_text
        await db.commit()
        await db.refresh(comment)
    return comment

#obtener comentarios
async def get_client_comments(db: AsyncSession, client_id: int):
    query = select(ClientComment).where(
        ClientComment.client_id == client_id
    ).order_by(ClientComment.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()