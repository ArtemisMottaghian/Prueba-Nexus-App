import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import isotipoNexus from '../../assets/isotipo-nexus.svg';
import './Sidebar.css';
import { markOffline, getTotalUnread } from '../../services/chatService';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout, hasRole, hasAnyRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Carga inicial y polling de respaldo (cuando InboxPage no está montado,
    // ej: el usuario está en otra página).
    getTotalUnread().then(setUnreadCount).catch(() => {});
    const interval = setInterval(() => {
      getTotalUnread().then(setUnreadCount).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // InboxPage emite este evento cada vez que cambia su estado de conversaciones.
    // Actualiza el badge inmediatamente sin esperar al polling de 30s.
    const handler = (e) => setUnreadCount(e.detail.total);
    window.addEventListener('chat:unread', handler);
    return () => window.removeEventListener('chat:unread', handler);
  }, []);

  const handleLogout = async () => {
    await markOffline();
    logout();
    if (onClose) onClose();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div className="sidebar-overlay d-lg-none" onClick={onClose}></div>
      )}

      <aside
        className={`ara-sidebar ${isOpen ? 'sidebar-open' : ''}`}
        id="sidebar"
      >
        <div className="sidebar-content">
          <div className="sidebar-logo d-flex justify-content-between align-items-center">
            <div className="logo-wrapper" aria-label="Nexus AI">
              <img
                src={isotipoNexus}
                alt=""
                className="logo-isotipo"
                width="33"
                height="33"
                decoding="async"
              />
              <span className="sidebar-logo-text">Nexus AI</span>
            </div>
            <button className="btn-close-sidebar d-lg-none" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-nav-section">
              <NavLink to="/" end className="sidebar-item" onClick={onClose}>
                <i className="bi bi-house"></i>
                <span className="sidebar-text">Inicio</span>
              </NavLink>
            </div>

            {hasAnyRole(['admin', 'hr_manager', 'company']) && (
              <div className="sidebar-nav-section">
                <NavLink
                  to="/vacantes"
                  className="sidebar-item"
                  onClick={onClose}
                >
                  <i className="bi bi-briefcase"></i>
                  <span className="sidebar-text">Vacantes</span>
                </NavLink>
                <NavLink
                  to="/candidatos"
                  className="sidebar-item"
                  onClick={onClose}
                >
                  <i className="bi bi-people"></i>
                  <span className="sidebar-text">Candidatos</span>
                </NavLink>
                {hasAnyRole(['admin', 'negocio', 'company']) && (
                  <NavLink
                    to="/clientes"
                    className="sidebar-item"
                    onClick={onClose}
                  >
                    <i className="bi bi-building"></i>
                    <span className="sidebar-text">Clientes</span>
                  </NavLink>
                )}
                <NavLink to="/inbox" className="sidebar-item" onClick={onClose}>
                  <i className="bi bi-envelope"></i>
                  <span className="sidebar-text">Inbox</span>
                  {unreadCount > 0 && (
                    <span className="sidebar-unread-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
                <NavLink
                  to="/calendar"
                  className="sidebar-item"
                  onClick={onClose}
                >
                  <i className="bi bi-calendar-check"></i>
                  <span className="sidebar-text">Calendario</span>
                </NavLink>
              </div>
            )}
          </nav>

          <div className="sidebar-footer pb-3">
            <NavLink to="/cuenta" className="sidebar-item" onClick={onClose}>
              <i className="bi bi-person-gear"></i>
              <span className="sidebar-text">Gestionar tu cuenta</span>
            </NavLink>

            {hasRole('admin') && (
              <NavLink
                to="/settings"
                className="sidebar-item"
                onClick={onClose}
              >
                <i className="bi bi-gear"></i>
                <span className="sidebar-text">Configuración del sistema</span>
              </NavLink>
            )}

            <button
              className="sidebar-item logout-btn-link w-100 border-0 bg-transparent text-start"
              onClick={handleLogout}
            >
              <i className="bi bi-box-arrow-right"></i>
              <span className="sidebar-text">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
