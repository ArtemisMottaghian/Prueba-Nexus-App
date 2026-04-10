import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Importante: Seguridad
import logoNexus from '../../assets/logo-nexus.svg';
import isotipoNexus from '../../assets/isotipo-nexus.svg';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout, hasRole, user } = useAuth(); // Pillamos las funciones de Jose

  // Mantenemos TU estado de grupos abiertos
  const [openGroups, setOpenGroups] = useState({
    vision: true,
    reclutamiento: false,
    comunicacion: false,
    engine: false,
  });

  const toggleGroup = (group) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  // Usamos el logout de Jose que es más seguro
  const handleLogout = () => {
    logout();
    if (onClose) onClose();
    navigate('/login');
  };

  // Mantenemos TU función de UX Pro
  const handleMouseLeave = () => {
    if (isOpen) return; // En móvil no cerramos nada
    setOpenGroups({
      vision: false,
      reclutamiento: false,
      comunicacion: false,
      engine: false,
    });
  };

  return (
    <>
      {isOpen && (
        <div className="sidebar-overlay d-lg-none" onClick={onClose}></div>
      )}

      <aside
        className={`ara-sidebar ${isOpen ? 'sidebar-open' : ''}`}
        id="sidebar"
        onMouseLeave={handleMouseLeave}
      >
        <div className="sidebar-content">
          <div className="sidebar-logo d-flex justify-content-between align-items-center px-3">
            <div className="logo-wrapper">
              <img
                src={isotipoNexus}
                alt="NexusAI Icon"
                className="logo-small"
              />
              <img src={logoNexus} alt="NexusAI Full" className="logo-large" />
            </div>
            <button className="btn-close-sidebar d-lg-none" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <nav className="sidebar-nav">
            {/* GRUPO: VISIÓN GENERAL (Todos lo ven) */}
            <div className="sidebar-group">
              <div
                className="sidebar-group-header"
                onClick={() => toggleGroup('vision')}
              >
                <div className="group-header-left">
                  <i className="bi bi-speedometer2 group-icon"></i>
                  <span className="sidebar-group-text">VISIÓN GENERAL</span>
                </div>
                <i
                  className={`bi bi-chevron-down chevron-icon ${openGroups.vision ? 'rotate' : ''}`}
                ></i>
              </div>
              <div
                className={`sidebar-group-items ${openGroups.vision ? 'show' : ''}`}
              >
                <NavLink to="/" end className="sidebar-item" onClick={onClose}>
                  <i className="bi bi-house"></i>
                  <span className="sidebar-text">Inicio</span>
                </NavLink>
                <NavLink
                  to="/analitica"
                  className="sidebar-item"
                  onClick={onClose}
                >
                  <i className="bi bi-bar-chart"></i>
                  <span className="sidebar-text">Analítica</span>
                </NavLink>
              </div>
            </div>

            {/* GRUPO: RECLUTAMIENTO (Solo Admin y Reclutador) */}
            {(hasRole('admin') || hasRole('reclutador')) && (
              <div className="sidebar-group">
                <div
                  className="sidebar-group-header"
                  onClick={() => toggleGroup('reclutamiento')}
                >
                  <div className="group-header-left">
                    <i className="bi bi-briefcase group-icon"></i>
                    <span className="sidebar-group-text">RECLUTAMIENTO</span>
                  </div>
                  <i
                    className={`bi bi-chevron-down chevron-icon ${openGroups.reclutamiento ? 'rotate' : ''}`}
                  ></i>
                </div>
                <div
                  className={`sidebar-group-items ${openGroups.reclutamiento ? 'show' : ''}`}
                >
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
                  <NavLink
                    to="/clientes"
                    className="sidebar-item"
                    onClick={onClose}
                  >
                    <i className="bi bi-building"></i>
                    <span className="sidebar-text">Clientes</span>
                  </NavLink>
                </div>
              </div>
            )}

            {/* GRUPO: COMUNICACIÓN (Solo Admin) */}
            {hasRole('admin') && (
              <div className="sidebar-group">
                <div
                  className="sidebar-group-header"
                  onClick={() => toggleGroup('comunicacion')}
                >
                  <div className="group-header-left">
                    <i className="bi bi-chat-dots group-icon"></i>
                    <span className="sidebar-group-text">COMUNICACIÓN</span>
                  </div>
                  <i
                    className={`bi bi-chevron-down chevron-icon ${openGroups.comunicacion ? 'rotate' : ''}`}
                  ></i>
                </div>
                <div
                  className={`sidebar-group-items ${openGroups.comunicacion ? 'show' : ''}`}
                >
                  <NavLink
                    to="/inbox"
                    className="sidebar-item"
                    onClick={onClose}
                  >
                    <i className="bi bi-envelope"></i>
                    <span className="sidebar-text">Inbox</span>
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
              </div>
            )}

            {/* GRUPO: NEXUS ENGINE (Admin y Negocio) */}
            {(hasRole('admin') || hasRole('negocio')) && (
              <div className="sidebar-group">
                <div
                  className="sidebar-group-header"
                  onClick={() => toggleGroup('engine')}
                >
                  <div className="group-header-left">
                    <i className="bi bi-cpu group-icon"></i>
                    <span className="sidebar-group-text">NEXUS ENGINE</span>
                  </div>
                  <i
                    className={`bi bi-chevron-down chevron-icon ${openGroups.engine ? 'rotate' : ''}`}
                  ></i>
                </div>
                <div
                  className={`sidebar-group-items ${openGroups.engine ? 'show' : ''}`}
                >
                  <NavLink
                    to="/smart-match"
                    className="sidebar-item"
                    onClick={onClose}
                  >
                    <i className="bi bi-stars"></i>
                    <span className="sidebar-text">Smart Match</span>
                  </NavLink>
                  <NavLink
                    to="/scraping"
                    className="sidebar-item"
                    onClick={onClose}
                  >
                    <i className="bi bi-robot"></i>
                    <span className="sidebar-text">Scraping & Fuentes</span>
                  </NavLink>
                </div>
              </div>
            )}
          </nav>

          <div className="flex-grow-1" style={{ minHeight: '20px' }}></div>

          <div className="sidebar-footer px-2 pb-3">
            {/* Info del usuario logueado (Cortesía de Jose) */}
            {user && (
              <div
                className="sidebar-user-email px-3 pb-3 mb-2"
                style={{
                  fontSize: '0.7rem',
                  color: 'rgba(255,255,255,0.4)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                Usuario:{' '}
                <strong style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {user.email}
                </strong>
              </div>
            )}

            {hasRole('admin') && (
              <NavLink
                to="/settings"
                className="sidebar-item"
                onClick={onClose}
              >
                <i className="bi bi-gear"></i>
                <span className="sidebar-text">Configuración</span>
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

