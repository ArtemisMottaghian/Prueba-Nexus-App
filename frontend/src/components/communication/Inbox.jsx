import { useState, useEffect, useCallback, useRef } from 'react';
import './Inbox.css';
import { ChatThread } from './ChatThread';
import { usersService } from '../../services/userManagementService';
import { useAuth } from '../../context/AuthContext';

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

const InboxComponent = ({
  conversations,
  onSelectChat,
  selectedChatId,
  onSendMessage,
  onNewChat,
  onDeleteMessage,
  onEditMessage,
  onArchive,
  onDeleteChat,
  onLoadMore,
  isLoading,
  showArchived,
  onToggleArchived,
  typingConvId,
  onTyping,
}) => {
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [showPicker, setShowPicker] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const pickerRef = useRef(null);

  const showSidebar = !isMobile || !selectedChatId;
  const showChatPanel = !isMobile || selectedChatId;

  const handleSelect = useCallback(
    (conv) => onSelectChat(conv.id),
    [onSelectChat]
  );

  const handleBack = useCallback(() => onSelectChat(null), [onSelectChat]);

  const selectedConversation = conversations.find(
    (c) => c.id === selectedChatId
  );

  const handleOpenPicker = async () => {
    setShowPicker((v) => !v);
    if (users.length > 0) return;
    setLoadingUsers(true);
    try {
      const all = await usersService.getAllUsers();
      setUsers(all.filter((u) => u.id !== user?.id));
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handlePickUser = async (userId) => {
    setShowPicker(false);
    if (onNewChat) await onNewChat(userId);
  };

  // Cerrar picker al hacer click fuera
  useEffect(() => {
    if (!showPicker) return;
    const onClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showPicker]);

  return (
    <div className="inbox-container">
      {showSidebar && (
        <aside className="inbox-sidebar">
          <div className="inbox-header">
            <h2>{showArchived ? 'Archivados' : 'Mensajes'}</h2>
            <div className="inbox-header-actions">
              <span className="badge">{conversations.length}</span>
              <button
                type="button"
                className={`archive-toggle-btn ${showArchived ? 'archive-toggle-btn--active' : ''}`}
                onClick={onToggleArchived}
                title={showArchived ? 'Ver mensajes activos' : 'Ver archivados'}
              >
                <i
                  className={`bi ${showArchived ? 'bi-chat-dots' : 'bi-archive'}`}
                  aria-hidden
                />
              </button>
              <div className="new-chat-wrapper" ref={pickerRef}>
                <button
                  className="new-chat-btn"
                  onClick={handleOpenPicker}
                  title="Nueva conversación"
                  type="button"
                >
                  +
                </button>
                {showPicker && (
                  <div className="user-picker">
                    <p className="user-picker-title">Nueva conversación</p>
                    {loadingUsers ? (
                      <p className="user-picker-empty">Cargando...</p>
                    ) : users.length === 0 ? (
                      <p className="user-picker-empty">No hay usuarios</p>
                    ) : (
                      <div className="user-picker-list">
                        {users.map((u) => (
                          <div
                            key={u.id}
                            className="user-picker-item"
                            onClick={() => handlePickUser(u.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handlePickUser(u.id);
                            }}
                          >
                            <div className="avatar avatar--sm">
                              {(u.name || u.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="user-picker-name">
                                {u.name || u.email}
                              </p>
                              <p className="user-picker-role">{u.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="inbox-list">
            {isLoading ? (
              <div className="text-center p-3">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : (
              conversations.map((conv) => {
                const lastMsg = conv.messages[conv.messages.length - 1];
                return (
                  <div
                    key={conv.id}
                    className={`conversation-item ${selectedChatId === conv.id ? 'active' : ''}`}
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
                        <span className="time">{lastMsg?.timestamp ?? ''}</span>
                      </div>
                      <div className="conv-bottom">
                        <p className="last-msg">{lastMsg?.content ?? ''}</p>
                        {conv.unread_count > 0 && (
                          <span className="unread-badge">
                            {conv.unread_count > 99 ? '99+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {showChatPanel && (
        <main className="chat-window">
          <ChatThread
            selectedConversation={selectedConversation}
            isMobile={isMobile}
            handleBack={handleBack}
            onSendMessage={onSendMessage}
            onDeleteMessage={onDeleteMessage}
            onEditMessage={onEditMessage}
            onArchive={onArchive}
            onDeleteChat={onDeleteChat}
            onLoadMore={onLoadMore}
            isArchived={showArchived}
            isTyping={typingConvId === selectedChatId}
            onTyping={onTyping}
          />
        </main>
      )}
    </div>
  );
};

export default InboxComponent;
