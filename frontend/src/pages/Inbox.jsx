import { useState, useEffect, useCallback, useRef } from 'react';
import InboxComponent from '../components/communication/Inbox';
import {
  getChats,
  getMessages,
  sendMessage,
  markAsRead,
  createConversation,
} from '../services/chatService';

const POLL_INTERVAL = 4000;

const InboxPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const selectedChatIdRef = useRef(null);

  // Mantener ref sincronizada para usarla dentro del intervalo sin stale closure
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  // Carga inicial de conversaciones
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getChats()
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
  }, []);

  // Polling cada POLL_INTERVAL: mensajes del chat activo + estado online de todos
  useEffect(() => {
    const interval = setInterval(async () => {
      const convId = selectedChatIdRef.current;

      // Lanzar ambas peticiones en paralelo
      const fetches = [
        getChats().catch(() => null),
        convId ? getMessages(convId).catch(() => null) : Promise.resolve(null),
      ];

      const [freshConvs, freshMsgs] = await Promise.all(fetches);

      setConversations((prev) => {
        return prev.map((c) => {
          // Actualizar online y último mensaje desde la lista fresca
          const fresh = freshConvs?.find((f) => f.id === c.id);
          const updated = fresh
            ? { ...c, online: fresh.online, unread_count: fresh.unread_count }
            : c;

          // Actualizar mensajes del chat activo si hay nuevos
          if (convId && c.id === convId && freshMsgs) {
            const lastKnown = updated.messages[updated.messages.length - 1];
            const lastFetched = freshMsgs.messages[freshMsgs.messages.length - 1];
            if (lastFetched && (!lastKnown || lastKnown.id !== lastFetched.id)) {
              return { ...updated, messages: freshMsgs.messages };
            }
          }

          return updated;
        });
      });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const handleSelectChat = useCallback(async (convId) => {
    setSelectedChatId(convId);
    if (!convId) return;
    try {
      const [{ messages }] = await Promise.all([
        getMessages(convId),
        markAsRead(convId),
      ]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, messages, unread_count: 0 } : c
        )
      );
    } catch (err) {
      console.error('Error al cargar mensajes:', err);
    }
  }, []);

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

  return (
    <div className="inbox-page-wrapper">
      <InboxComponent
        conversations={conversations}
        selectedChatId={selectedChatId}
        onSelectChat={handleSelectChat}
        onSendMessage={handleSendMessage}
        onNewChat={handleNewChat}
        isLoading={isLoading}
      />
    </div>
  );
};

export default InboxPage;
