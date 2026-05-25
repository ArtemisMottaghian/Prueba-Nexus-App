-- =============================================
-- 1. MIGRACIÓN (crear tablas si no existen)
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS conversations (
    id         BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at    TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

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

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_user_id
    ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation_id
    ON conversation_participants(conversation_id);

-- Triggers (la función update_updated_at_column() ya existe en la DB)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversations_modtime'
    ) THEN
        CREATE TRIGGER update_conversations_modtime
            BEFORE UPDATE ON conversations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_messages_modtime'
    ) THEN
        CREATE TRIGGER update_messages_modtime
            BEFORE UPDATE ON messages
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;


-- =============================================
-- 2. DATOS DE PRUEBA
-- Usa los dos primeros usuarios reales de la DB
-- =============================================

DO $$
DECLARE
    user1_id BIGINT;
    user2_id BIGINT;
    user3_id BIGINT;
    conv1_id BIGINT;
    conv2_id BIGINT;
BEGIN
    -- Obtener los primeros usuarios disponibles
    SELECT id INTO user1_id FROM users ORDER BY id LIMIT 1;
    SELECT id INTO user2_id FROM users ORDER BY id OFFSET 1 LIMIT 1;
    SELECT id INTO user3_id FROM users ORDER BY id OFFSET 2 LIMIT 1;

    IF user1_id IS NULL OR user2_id IS NULL THEN
        RAISE NOTICE 'Necesitas al menos 2 usuarios en la tabla users para el seed.';
        RETURN;
    END IF;

    -- Marcar user1 como "online" (visto hace 1 minuto)
    UPDATE users SET last_seen_at = NOW() - INTERVAL '1 minute' WHERE id = user1_id;
    -- user2 offline (visto hace 2 horas)
    UPDATE users SET last_seen_at = NOW() - INTERVAL '2 hours' WHERE id = user2_id;

    -- ---- Conversación 1: user1 <-> user2 ----
    INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv1_id;

    INSERT INTO conversation_participants (conversation_id, user_id, last_read_at)
    VALUES
        (conv1_id, user1_id, NOW()),
        (conv1_id, user2_id, NOW() - INTERVAL '10 minutes');

    -- Mensajes de prueba (sin cifrar, content_iv = NULL)
    INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES
        (conv1_id, user2_id, '¿Cuándo es la entrevista de selección?',   NOW() - INTERVAL '30 minutes'),
        (conv1_id, user1_id, 'El día 08 de mayo a las 11:00 AM',          NOW() - INTERVAL '25 minutes'),
        (conv1_id, user2_id, 'Perfecto, muchas gracias',                  NOW() - INTERVAL '20 minutes'),
        (conv1_id, user1_id, 'Cualquier cambio te aviso por aquí.',       NOW() - INTERVAL '15 minutes');

    -- Actualizar updated_at de la conversación al último mensaje
    UPDATE conversations SET updated_at = NOW() - INTERVAL '15 minutes' WHERE id = conv1_id;

    -- ---- Conversación 2: user1 <-> user3 (si existe) ----
    IF user3_id IS NOT NULL THEN
        INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv2_id;

        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES
            (conv2_id, user1_id),
            (conv2_id, user3_id);

        INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES
            (conv2_id, user3_id, 'He revisado el perfil del candidato, me interesa.',  NOW() - INTERVAL '2 hours'),
            (conv2_id, user1_id, 'Genial, le propongo para la vacante de Senior.',     NOW() - INTERVAL '1 hour 50 minutes'),
            (conv2_id, user3_id, '¿Podría mandarme su CV actualizado?',               NOW() - INTERVAL '1 hour');

        UPDATE conversations SET updated_at = NOW() - INTERVAL '1 hour' WHERE id = conv2_id;
    END IF;

    RAISE NOTICE 'Seed completado. Conversación 1 ID: %, Conversación 2 ID: %', conv1_id, conv2_id;
END $$;
