import React, { useState } from 'react';
import './Inbox.css';

const InboxComponent = ({ conversations, onSelectConversation }) => {
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="inbox-container">
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
              onClick={() => {
                setSelectedId(conv.id);
                onSelectConversation(conv);
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

      <main className="chat-window">
        {selectedId ? (
          <>
            <header className="chat-header">
              <h3>{conversations.find(c => c.id === selectedId)?.name}</h3>
            </header>
            <div className="chat-messages">
              <div className="empty-state">
                <p>Cargando historial de mensajes para este candidato...</p>
              </div>
            </div>
            <footer className="chat-input">
              <input type="text" placeholder="Escribe un mensaje de seguimiento..." />
              <button className="send-btn">Enviar</button>
            </footer>
          </>
        ) : (
          <div className="no-selection">
            <div>
              <i className="bi bi-chat-dots" style={{ fontSize: '3rem', color: 'var(--clr-purple)', display: 'block', marginBottom: '1rem' }}></i>
              <p>Selecciona una conversación para ver los detalles</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InboxComponent;