import { useState, useEffect, useCallback } from 'react';
import './Inbox.css';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

const InboxComponent = ({ conversations, onSelectConversation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const showSidebar = !isMobile || !selectedId;
  const showChatPanel = !isMobile || !!selectedId;

  const handleSelect = useCallback(
    (conv) => {
      setSelectedId(conv.id);
      onSelectConversation(conv);
    },
    [onSelectConversation]
  );

  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div className="inbox-container">
      {showSidebar && (
        <aside className="inbox-sidebar">
          <div className="inbox-header">
            <h2>Mensajes</h2>
            <span className="badge">{conversations.length}</span>
          </div>
          <div className="inbox-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
                onClick={() => handleSelect(conv)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(conv);
                  }
                }}
              >
                <div className="avatar">{conv.name.charAt(0)}</div>
                <div className="conv-info">
                  <div className="conv-top">
                    <span className="name">{conv.name}</span>
                    <span className="time">{conv.time}</span>
                  </div>
                  <p className="last-msg">{conv.lastMessage}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {showChatPanel && (
        <main className="chat-window">
          {selectedId ? (
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
                <h3>{conversations.find((c) => c.id === selectedId)?.name}</h3>
              </header>
              <div className="chat-messages">
                <div className="empty-state">
                  <p>Cargando historial de mensajes para este candidato...</p>
                </div>
              </div>
              <footer className="chat-input">
                <input
                  type="text"
                  placeholder="Escribe un mensaje de seguimiento..."
                />
                <button type="button" className="send-btn">
                  Enviar
                </button>
              </footer>
            </>
          ) : (
            <div className="no-selection">
              <div>
                <i className="bi bi-chat-dots no-selection__icon" aria-hidden />
                <p>Selecciona una conversación para ver los detalles</p>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default InboxComponent;
