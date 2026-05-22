-- =============================================
-- MIGRACIÓN: Sistema de Chat Interno
-- Ejecutar contra la base de datos existente
-- =============================================

-- Campo last_seen_at en users (para indicador de online)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;


-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
    id         BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE conversations IS 'Conversaciones 1:1 entre usuarios del sistema';


-- Tabla de participantes (M:M usuarios ↔ conversaciones)
CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at    TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);
COMMENT ON TABLE conversation_participants IS 'Qué usuarios pertenecen a cada conversación y cuándo leyeron por última vez';


-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content         TEXT NOT NULL,
    content_iv      BYTEA,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE messages IS 'Mensajes cifrados (AES-256-GCM) de las conversaciones';


-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participants_user_id
    ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_participants_conversation_id
    ON conversation_participants(conversation_id);

-- Cubre ORDER BY updated_at DESC en list_conversations
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
    ON conversations(updated_at DESC);

-- Partial index para unread count: excluye mensajes eliminados del índice
-- Cubre: WHERE conversation_id IN (...) AND sender_id != X AND is_deleted = false AND created_at > Y
CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON messages(conversation_id, created_at, sender_id)
    WHERE is_deleted = false;

-- Cubre el MAX(id) por conversación usado en list_conversations optimizado
CREATE INDEX IF NOT EXISTS idx_messages_conversation_max_id
    ON messages(conversation_id, id DESC)
    WHERE is_deleted = false;


-- Trigger updated_at para conversations
CREATE TRIGGER update_conversations_modtime
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger updated_at para messages
CREATE TRIGGER update_messages_modtime
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
