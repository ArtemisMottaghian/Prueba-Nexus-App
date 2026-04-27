import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Topbar.css';

const TITLES = {
  '/': 'Dashboard',
  '/vacantes': 'Vacantes',
  '/candidatos': 'Candidatos',
  '/clientes': 'Clientes',
  '/inbox': 'Inbox',
  '/calendar': 'Calendario',
  '/analitica': 'Analítica',
  '/smart-match': 'Smart Match',
  '/scraping': 'Scraping & Fuentes',
  '/settings': 'Configuración',
  '/users': 'Gestión de Usuarios',
};

const THEME_KEY = 'nexus-theme';

export default function Topbar({ onMenuToggle }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const location = useLocation();
  const pageTitle = TITLES[location.pathname] || 'Dashboard';

  // Tema Claro/Oscuro
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.setAttribute('data-bs-theme', 'dark');
    } else {
      html.removeAttribute('data-bs-theme');
    }
    try {
      localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="ara-topbar">
      <div className="topbar-content">
        {/* Izquierda: Menú móvil y Título */}
        <div className="d-flex align-items-center gap-3">
          <button className="btn-icon d-lg-none" onClick={onMenuToggle}>
            <i className="bi bi-list"></i>
          </button>
          <h1 className="topbar-title">{pageTitle}</h1>
        </div>

        {/* Derecha: Switch y Perfil */}
        <div className="d-flex align-items-center gap-4">
          <div
            className={`theme-selector-container ${isDarkMode ? 'is-dark' : 'is-light'}`}
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={
              isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
            }
          >
            <div className="theme-switch-pill">
              <i className="bi bi-sun sun-bg"></i>
              <i className="bi bi-moon-stars moon-bg"></i>
              <div className="switch-knob"></div>
            </div>
          </div>
          <div className="profile-menu-wrapper" ref={profileMenuRef}>
            <div
              className="topbar-avatar"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              title="Cuenta de Nexus"
            >
              <div className="avatar-fallback">
                <span>A</span>
              </div>
            </div>
            {isProfileOpen && (
              <div
                className={
                  isDarkMode ? 'profile-dropdown is-dark' : 'profile-dropdown'
                }
              >
                {/* Cabecera del menú */}
                <div className="profile-header">
                  <div className="profile-header-avatar">A</div>
                  <div className="profile-header-info">
                    <span className="profile-name">Administrador</span>
                    <span className="profile-email">admin@nexus-app.com</span>
                    <span className="profile-role">
                      <i className="bi bi-shield-lock-fill me-1"></i> Admin
                    </span>
                  </div>
                </div>

                <div className="profile-divider"></div>

                {/* Opciones */}
                <div className="profile-options">
                  <button className="profile-btn">
                    <i className="bi bi-person-badge"></i>
                    Gestionar tu cuenta
                  </button>
                  <button className="profile-btn">
                    <i className="bi bi-gear"></i>
                    Configuración del sistema
                  </button>
                </div>

                <div className="profile-divider"></div>

                {/* Cerrar sesión */}
                <div className="profile-options">
                  <button className="profile-btn btn-logout">
                    <i className="bi bi-box-arrow-right"></i>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
