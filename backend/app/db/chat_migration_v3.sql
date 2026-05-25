-- =============================================
-- MIGRACIÓN v3: Notificaciones email por usuario
-- Ejecutar después de chat_migration_v2.sql
-- =============================================

-- Preferencia de notificación por email (desactivada por defecto)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT FALSE;
