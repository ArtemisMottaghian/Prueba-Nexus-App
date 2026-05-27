import { useState, useEffect, useCallback, useRef } from 'react';
import InboxComponent from '../components/communication/Inbox';
import {
  getChats,
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
  editMessage,
  archiveConversation,
  deleteConversation,
  createConversation,
  openChatStream,
  sendTyping,
} from '../services/chatService';

// Intervalo de polling cuando SSE está activo (solo sincroniza online-status)
const POLL_INTERVAL_SSE = 15000;
// Intervalo de polling cuando SSE no está disponible (sincroniza mensajes también)
const POLL_INTERVAL_FALLBACK = 4000;

const InboxPage = () => {
  // ─── Estado principal ────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [typingConvId, setTypingConvId] = useState(null);
  const [sseActive, setSseActive] = useState(false);

  // ─── Refs para evitar stale closures en callbacks y effects ──────────────────
  // Se usan refs en lugar de estado para leer valores actuales dentro de
  // intervalos y listeners sin añadirlos como dependencias y evitar re-renders.
  const showArchivedRef = useRef(false);
  const typingTimerRef = useRef(null);
  const selectedChatIdRef = useRef(null);
  const conversationsRef = useRef(conversations);

  // ─── Sincronización de refs con el estado ────────────────────────────────────
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    showArchivedRef.current = showArchived;
  }, [showArchived]);

  // ─── SSE: recepción de eventos en tiempo real ────────────────────────────────
  // Abre un stream con el backend. Gestiona: mensajes nuevos, eliminaciones,
  // ediciones e indicadores de escritura. Se monta una sola vez.
  useEffect(() => {
    const close = openChatStream((event) => {
      if (event.type === 'connected') {
        setSseActive(true);
      } else if (event.type === 'new_message') {
        // Añade el mensaje a la conversación correspondiente.
        // Si el chat está activo, marca como leído (unread_count = 0).
        const { conv_id, message } = event;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conv_id) return c;
            const alreadyExists = c.messages.some((m) => m.id === message.id);
            if (alreadyExists) return c;
            const mapped = {
              id: message.id,
              senderId: message.is_mine ? 'me' : 'other',
              content: message.is_deleted
                ? '[Mensaje eliminado]'
                : message.content,
              timestamp: new Date(message.created_at).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              isDeleted: message.is_deleted,
              isEdited: message.is_edited ?? false,
            };
            const isActive = selectedChatIdRef.current === conv_id;
            return {
              ...c,
              messages: [...c.messages, mapped],
              unread_count: isActive ? 0 : (c.unread_count ?? 0) + 1,
            };
          })
        );
      } else if (event.type === 'message_deleted') {
        // Marca el mensaje como eliminado sin borrarlo del array
        const { conv_id, message_id } = event;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conv_id) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === message_id
                  ? { ...m, content: '[Mensaje eliminado]', isDeleted: true }
                  : m
              ),
            };
          })
        );
      } else if (event.type === 'message_edited') {
        // Actualiza el contenido del mensaje editado
        const { conv_id, message } = event;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conv_id) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === message.id
                  ? {
                      ...m,
                      content: message.content,
                      isEdited: true,
                      isDeleted: false,
                    }
                  : m
              ),
            };
          })
        );
      } else if (event.type === 'conversation_deleted') {
        const { conv_id } = event;
        setConversations((prev) => prev.filter((c) => c.id !== conv_id));
        setSelectedChatId((prev) => (prev === conv_id ? null : prev));
      } else if (event.type === 'typing') {
        // Muestra el indicador de escritura 3 segundos y luego lo oculta
        setTypingConvId(event.conv_id);
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingConvId(null), 3000);
      }
    });

    return () => {
      close();
      clearTimeout(typingTimerRef.current);
    };
  }, []);

  // ─── Carga inicial y recarga al cambiar entre activos/archivados ─────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSelectedChatId(null);
    setConversations([]);

    getChats(showArchived)
      .then((data) => {
        if (!cancelled) setConversations(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled)
          setError(
            'No se pudieron cargar las conversaciones. Comprueba que el servidor esté activo.'
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showArchived]);

  // ─── Polling periódico ───────────────────────────────────────────────────────
  // Si SSE está activo: solo refresca online-status cada 15s.
  // Si SSE no está activo: también recarga mensajes del chat seleccionado cada 4s.
  useEffect(() => {
    const tick = async () => {
      const convId = selectedChatIdRef.current;
      const useSSE = sseActive;

      const fetches = [
        getChats(showArchivedRef.current).catch(() => null),
        !useSSE && convId
          ? getMessages(convId).catch(() => null)
          : Promise.resolve(null),
      ];

      const [freshConvs, freshMsgs] = await Promise.all(fetches);

      setConversations((prev) =>
        prev.map((c) => {
          const fresh = freshConvs?.find((f) => f.id === c.id);
          const updated = fresh
            ? { ...c, online: fresh.online, unread_count: fresh.unread_count }
            : c;

          // Solo actualiza mensajes si SSE no está disponible y hay mensajes nuevos
          if (!useSSE && convId && c.id === convId && freshMsgs) {
            const lastKnown = updated.messages[updated.messages.length - 1];
            const lastFetched =
              freshMsgs.messages[freshMsgs.messages.length - 1];
            if (
              lastFetched &&
              (!lastKnown || lastKnown.id !== lastFetched.id)
            ) {
              return { ...updated, messages: freshMsgs.messages };
            }
          }

          return updated;
        })
      );
    };

    const interval = setInterval(
      tick,
      sseActive ? POLL_INTERVAL_SSE : POLL_INTERVAL_FALLBACK
    );
    return () => clearInterval(interval);
  }, [sseActive]);

  // ─── Handlers de conversación ────────────────────────────────────────────────

  // Selecciona un chat: carga sus mensajes y lo marca como leído
  const handleSelectChat = useCallback(async (convId) => {
    setSelectedChatId(convId);
    if (!convId) return;
    try {
      const [{ messages, next_cursor, has_more }] = await Promise.all([
        getMessages(convId),
        markAsRead(convId),
      ]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages,
                unread_count: 0,
                cursor: next_cursor,
                hasMore: has_more,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error al cargar mensajes:', err);
    }
  }, []);

  // Envía un mensaje en el chat activo y lo añade al estado local
  const handleSendMessage = useCallback(
    async (content) => {
      if (!selectedChatId) return;
      try {
        const newMsg = await sendMessage(selectedChatId, content);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChatId
              ? { ...c, messages: [...c.messages, newMsg] }
              : c
          )
        );
      } catch (err) {
        console.error('Error al enviar mensaje:', err);
      }
    },
    [selectedChatId]
  );

  // Carga mensajes anteriores (paginación hacia atrás) usando el cursor guardado
  const handleLoadMore = useCallback(async () => {
    const convId = selectedChatIdRef.current;
    if (!convId) return;
    const conv = conversationsRef.current.find((c) => c.id === convId);
    if (!conv?.hasMore || !conv?.cursor) return;
    try {
      const {
        messages: older,
        next_cursor,
        has_more,
      } = await getMessages(convId, conv.cursor);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [...older, ...c.messages],
                cursor: next_cursor,
                hasMore: has_more,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error al cargar más mensajes:', err);
    }
  }, []);

  // Elimina un mensaje: llama al backend y actualiza el estado local
  const handleDeleteMessage = useCallback(async (messageId) => {
    const convId = selectedChatIdRef.current;
    if (!convId) return;
    try {
      await deleteMessage(convId, messageId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, content: '[Mensaje eliminado]', isDeleted: true }
                    : m
                ),
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error al eliminar mensaje:', err);
    }
  }, []);

  // Edita un mensaje: llama al backend y sustituye el mensaje en el estado local
  const handleEditMessage = useCallback(async (messageId, newContent) => {
    const convId = selectedChatIdRef.current;
    if (!convId) return;
    try {
      const updated = await editMessage(convId, messageId, newContent);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? updated : m
                ),
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error al editar mensaje:', err);
      throw err;
    }
  }, []);

  const handleDeleteChat = useCallback(async (convId) => {
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (selectedChatIdRef.current === convId) setSelectedChatId(null);
    } catch (err) {
      console.error('Error al eliminar conversación:', err);
      alert('No se pudo eliminar la conversación. Inténtalo de nuevo.');
    }
  }, []);

  // Archiva o desarchiva una conversación y la elimina de la vista actual
  const handleArchive = useCallback(async (convId, archived) => {
    try {
      await archiveConversation(convId, archived);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (selectedChatIdRef.current === convId) {
        setSelectedChatId(null);
      }
    } catch (err) {
      console.error('Error al archivar conversación:', err);
    }
  }, []);

  // Crea una nueva conversación con otro usuario y la selecciona automáticamente
  const handleNewChat = useCallback(
    async (otherUserId) => {
      try {
        const newConv = await createConversation(otherUserId);
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === newConv.id);
          return exists ? prev : [newConv, ...prev];
        });
        await handleSelectChat(newConv.id);
      } catch (err) {
        console.error('Error al crear conversación:', err);
      }
    },
    [handleSelectChat]
  );

  // FIX: extraído del JSX para no llamar useCallback condicionalmente dentro del return
  // Notifica al backend que el usuario está escribiendo en el chat activo
  const handleTyping = useCallback(() => {
    if (selectedChatIdRef.current) sendTyping(selectedChatIdRef.current);
  }, []);

  // ─── Render de error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="inbox-page-wrapper"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <p style={{ color: 'var(--color-error, #e53e3e)' }}>{error}</p>
      </div>
    );
  }

  // ─── Render principal ────────────────────────────────────────────────────────
  return (
    <div className="inbox-page-wrapper">
      <InboxComponent
        conversations={conversations}
        selectedChatId={selectedChatId}
        onSelectChat={handleSelectChat}
        onSendMessage={handleSendMessage}
        onNewChat={handleNewChat}
        onDeleteMessage={handleDeleteMessage}
        onEditMessage={handleEditMessage}
        onArchive={handleArchive}
        onDeleteChat={handleDeleteChat}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((v) => !v)}
        typingConvId={typingConvId}
        onTyping={handleTyping}
      />
    </div>
  );
};

export default InboxPage;
