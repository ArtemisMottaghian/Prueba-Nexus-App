import { MessageInput } from './MessageInput';
import { useEffect, useRef, useState } from 'react';

export function ChatThread({
  selectedConversation,
  isMobile,
  handleBack,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onArchive,
  onDeleteChat,
  onLoadMore,
  isArchived,
  isTyping,
  onTyping,
}) {
  const messagesEndRef = useRef(null);
  const editInputRef = useRef(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (!editingMsgId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages, editingMsgId]);

  useEffect(() => {
    if (editingMsgId) {
      editInputRef.current?.focus();
    }
  }, [editingMsgId]);

  const startEdit = (msg) => {
    setEditingMsgId(msg.id);
    setEditDraft(msg.content);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditDraft('');
    setEditError('');
  };

  const submitEdit = async (msgId) => {
    if (!editDraft.trim()) return;
    try {
      await onEditMessage?.(msgId, editDraft.trim());
      cancelEdit();
    } catch (err) {
      setEditError(err.message || 'No se pudo editar el mensaje');
    }
  };

  if (!selectedConversation) {
    return (
      <div className="no-selection">
        <div>
          <i className="bi bi-chat-dots no-selection__icon" aria-hidden />
          <p>Selecciona un chat para empezar a conversar</p>
        </div>
      </div>
    );
  }

  const hasMore = selectedConversation.hasMore;
  const archiveTitle = isArchived
    ? 'Desarchivar conversación'
    : 'Archivar conversación';
  const archiveIcon = isArchived ? 'bi-archive-fill' : 'bi-archive';

  return (
    <>
      <header className="chat-header">
        {isMobile && (
          <button
            type="button"
            className="chat-header__back"
            onClick={handleBack}
            aria-label="Volver al listado"
          >
            <i className="bi bi-arrow-left" aria-hidden />
          </button>
        )}

        <div className="header-info">
          {selectedConversation.online === true ? (
            <span className="online-dot"></span>
          ) : (
            <span className="offline-dot"></span>
          )}
          <h2>{selectedConversation.name}</h2>
          <p>{selectedConversation.rol}</p>
        </div>

        <button
          type="button"
          className="chat-header__archive"
          onClick={() => onArchive?.(selectedConversation.id, !isArchived)}
          title={archiveTitle}
          aria-label={archiveTitle}
        >
          <i className={`bi ${archiveIcon}`} aria-hidden />
        </button>
        <button
          type="button"
          className="chat-header__delete"
          onClick={() => {
            if (window.confirm('¿Eliminar esta conversación? No se puede deshacer.')) {
              onDeleteChat?.(selectedConversation.id);
            }
          }}
          title="Eliminar conversación"
          aria-label="Eliminar conversación"
        >
          <i className="bi bi-trash3" aria-hidden />
        </button>
      </header>

      <div className="chat-messages">
        {hasMore && (
          <div className="load-more-wrapper">
            <button
              type="button"
              className="load-more-btn"
              onClick={onLoadMore}
            >
              Cargar mensajes anteriores
            </button>
          </div>
        )}

        {selectedConversation.messages.map((message) => (
          <div
            key={message.id}
            className={`d-flex ${
              message.senderId === 'me'
                ? 'justify-content-end'
                : 'justify-content-start'
            } mb-2 mx-5 msg-row`}
          >
            <div className="msg-bubble-wrapper">
              {message.senderId === 'me' &&
                !message.isDeleted &&
                !editingMsgId && (
                  <div className="msg-actions">
                    <button
                      type="button"
                      className="msg-action-btn"
                      onClick={() => startEdit(message)}
                      title="Editar"
                      aria-label="Editar mensaje"
                    >
                      <i className="bi bi-pencil" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="msg-action-btn msg-action-btn--danger"
                      onClick={() => onDeleteMessage?.(message.id)}
                      title="Eliminar"
                      aria-label="Eliminar mensaje"
                    >
                      <i className="bi bi-trash3" aria-hidden />
                    </button>
                  </div>
                )}
              {editingMsgId === message.id ? (
                <div className="msg-edit-form">
                  <textarea
                    ref={editInputRef}
                    className="msg-edit-input"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitEdit(message.id);
                      }
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    rows={2}
                  />
                  {editError && <p className="msg-edit-error">{editError}</p>}
                  <div className="msg-edit-actions">
                    <button
                      type="button"
                      className="msg-edit-save"
                      onClick={() => submitEdit(message.id)}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="msg-edit-cancel"
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`d-flex ${
                    message.senderId === 'me' ? 'mensajes_me' : 'mensajes_other'
                  } mb-2 mx-5 ${message.isDeleted ? 'msg--deleted' : ''}`}
                >
                  {message.content}
                  {message.isEdited && !message.isDeleted && (
                    <span className="msg-edited-label"> (editado)</span>
                  )}
                </div>
              )}
            </div>

            <div className="timestamp">{message.timestamp}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isTyping && (
        <div className="typing-indicator">
          <span className="typing-indicator__name">
            {selectedConversation.name}
          </span>
          &nbsp;está escribiendo
          <span className="typing-dots">
            <span />
            <span />
            <span />
          </span>
        </div>
      )}

      <footer>
        <MessageInput onSend={onSendMessage} onTyping={onTyping} />
      </footer>
    </>
  );
}
