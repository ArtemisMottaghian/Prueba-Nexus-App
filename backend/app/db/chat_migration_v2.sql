-- =============================================
-- MIGRACIÓN v2: Editar mensaje, archivar conversación
-- Ejecutar después de chat_migration.sql
-- =============================================

-- Campos de edición en messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;

-- Campo de archivo por participante (archivar es por usuario, no por conversación)
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: conversaciones activas (la mayoría) — cubre el WHERE is_archived = false del list
CREATE INDEX IF NOT EXISTS idx_participants_active
    ON conversation_participants(user_id)
    WHERE is_archived = false;
