import { MessageInput } from './MessageInput';
import { useEffect, useRef } from 'react';

export function ChatThread({
  selectedConversation,
  isMobile,
  handleBack,
  onSendMessage,
}) {
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [selectedConversation?.messages]);

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
      </header>

      {/* Organizamos mensajes segun: 'me' --> derecha / 'other' --> izquierda */}
      <div className="chat-messages">
        {selectedConversation.messages.map((message) => (
          <div
            key={message.id}
            className={`d-flex ${
              message.senderId === 'me'
                ? 'justify-content-end'
                : 'justify-content-start'
            } mb-2 mx-5`}
          >
            <div
              className={`d-flex ${
                message.senderId === 'me' ? 'mensajes_me' : 'mensajes_other'
              } mb-2 mx-5`}
            >
              {message.content}
            </div>

            <div className="timestamp">{message.timestamp}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <footer>
        <MessageInput onSend={onSendMessage} />
      </footer>
    </>
  );
}
