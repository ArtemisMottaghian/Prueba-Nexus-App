import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  '/cuenta': 'Gestionar tu cuenta',
};

const ROLE_LABELS = {
  admin: 'Admin',
  hr_manager: 'Reclutador',
  reclutador: 'Reclutador',
  negocio: 'Negocio',
  company: 'Empresa',
};

const THEME_KEY = 'nexus-theme';

export default function Topbar({ onMenuToggle }) {
  const { user } = useAuth();

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

  // Datos del usuario
  const userInitial = (user?.name ||
    user?.username ||
    user?.email ||
    'U')[0].toUpperCase();
  const userName = user?.name || user?.username || user?.email || 'Usuario';
  const userEmail = user?.email || '';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Usuario';

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
              title="Ver perfil"
            >
              <div className="avatar-fallback">
                <span>{userInitial}</span>
              </div>
            </div>

            {isProfileOpen && (
              <div
                className={
                  isDarkMode ? 'profile-dropdown is-dark' : 'profile-dropdown'
                }
              >
                <div className="profile-header">
                  <div className="profile-header-avatar">{userInitial}</div>
                  <div className="profile-header-info">
                    <span className="profile-name">{userName}</span>
                    <span className="profile-email">{userEmail}</span>
                    <span className="profile-role">
                      <i className="bi bi-shield-lock-fill me-1"></i>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
