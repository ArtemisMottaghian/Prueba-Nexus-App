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
  };
}

export async function getChats() {
  const res = await authFetch(ENDPOINTS.chat.list);
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

export async function createConversation(otherUserId) {
  const res = await authFetch(ENDPOINTS.chat.create, {
    method: 'POST',
    body: JSON.stringify({ other_user_id: otherUserId }),
  });
  if (!res.ok) throw new Error('Error al crear conversación');
  const data = await res.json();
  return mapConversation(data);
}
