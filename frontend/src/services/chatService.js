import { authFetch, ENDPOINTS } from './api';

// Mapea ConversationOut del backend al shape que espera InboxComponent
function mapConversation(conv) {
  return {
    id: conv.id,
    name: conv.other_user.name || conv.other_user.email,
    rol: conv.other_user.role,
    online: conv.other_user.is_online,
    unread_count: conv.unread_count,
    updated_at: conv.updated_at,
    is_archived: conv.is_archived ?? false,
    messages: conv.last_message
      ? [
          {
            id: conv.last_message.id,
            senderId: conv.last_message.is_mine ? 'me' : 'other',
            content: conv.last_message.is_deleted
              ? '[Mensaje eliminado]'
              : conv.last_message.content,
            timestamp: new Date(conv.last_message.created_at).toLocaleString(
              'es-ES',
              {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }
            ),
            isDeleted: conv.last_message.is_deleted,
          },
        ]
      : [],
  };
}

// Mapea MessageOut del backend al shape que espera ChatThread
function mapMessage(msg) {
  return {
    id: msg.id,
    senderId: msg.is_mine ? 'me' : 'other',
    content: msg.is_deleted ? '[Mensaje eliminado]' : msg.content,
    timestamp: new Date(msg.created_at).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    isDeleted: msg.is_deleted,
    isEdited: msg.is_edited ?? false,
  };
}

export async function getChats(archived = false) {
  const url = archived
    ? `${ENDPOINTS.chat.list}?archived=true`
    : ENDPOINTS.chat.list;
  const res = await authFetch(url);
  if (!res.ok) throw new Error('Error al cargar conversaciones');
  const data = await res.json();
  return data.map(mapConversation);
}

export async function getMessages(convId, cursor = null) {
  let url = ENDPOINTS.chat.messages(convId);
  if (cursor) url += `?cursor=${encodeURIComponent(cursor)}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error('Error al cargar mensajes');
  const data = await res.json();
  return {
    messages: data.messages.map(mapMessage),
    next_cursor: data.next_cursor,
    has_more: data.has_more,
  };
}

export async function sendMessage(convId, content) {
  const res = await authFetch(ENDPOINTS.chat.send(convId), {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Error al enviar mensaje');
  const msg = await res.json();
  return mapMessage(msg);
}

export async function markAsRead(convId) {
  await authFetch(ENDPOINTS.chat.markRead(convId), { method: 'PATCH' });
}

export async function markOffline() {
  try {
    await authFetch(ENDPOINTS.chat.offline, { method: 'POST' });
  } catch {
    // Silencioso — no bloquear el logout si falla
  }
}

export async function editMessage(convId, messageId, content) {
  const res = await authFetch(ENDPOINTS.chat.editMessage(convId, messageId), {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al editar mensaje');
  }
  return mapMessage(await res.json());
}

export async function getTotalUnread() {
  const res = await authFetch(ENDPOINTS.chat.unread);
  if (!res.ok) throw new Error('Error al obtener no leídos');
  const data = await res.json();
  return data.total;
}

/**
 * Abre una conexión SSE al servidor usando fetch + Authorization header.
 * Llama onEvent(event) por cada evento recibido.
 * Devuelve una función de cleanup que cierra la conexión.
 */
export function openChatStream(onEvent) {
  let abortController = new AbortController();
  let reconnectTimer = null;
  let closed = false;

  const connect = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(ENDPOINTS.chat.stream, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        signal: abortController.signal,
      });

      if (response.status === 401 || response.status === 403) return;
      if (!response.ok) throw new Error(`SSE ${response.status}`);

      onEvent({ type: 'connected' });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type !== 'ping') onEvent(event);
            } catch {
              // ignore malformed SSE line
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
    if (!closed) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  };

  connect();
  return () => {
    closed = true;
    clearTimeout(reconnectTimer);
    abortController.abort();
  };
}

export async function sendTyping(convId) {
  try {
    await authFetch(ENDPOINTS.chat.typing(convId), { method: 'POST' });
  } catch {
    // fire-and-forget
  }
}

export async function archiveConversation(convId, archived) {
  const res = await authFetch(ENDPOINTS.chat.archive(convId), {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  });
  if (!res.ok) throw new Error('Error al archivar conversación');
}

export async function deleteMessage(convId, messageId) {
  const res = await authFetch(ENDPOINTS.chat.deleteMessage(convId, messageId), {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar mensaje');
}

export async function createConversation(otherUserId) {
  const res = await authFetch(ENDPOINTS.chat.create, {
    method: 'POST',
    body: JSON.stringify({ other_user_id: otherUserId }),
  });
  if (!res.ok) throw new Error('Error al crear conversación');
  const data = await res.json();
  return mapConversation(data);
}
