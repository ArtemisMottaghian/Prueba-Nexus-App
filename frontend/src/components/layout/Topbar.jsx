import { useState, useLayoutEffect } from 'react';
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

  const location = useLocation();

  const pageTitle = TITLES[location.pathname] || 'Dashboard';

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

  return (
    <header className="ara-topbar">
      <div className="topbar-content">
        <div className="d-flex align-items-center gap-3">
          <button className="btn-icon d-lg-none" onClick={onMenuToggle}>
            <i className="bi bi-list"></i>
          </button>
          <h1 className="topbar-title">{pageTitle}</h1>
        </div>

        <div className="d-flex align-items-center gap-2 gap-md-3">
          <button
            className="btn-icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Cambiar tema"
          >
            {isDarkMode ? (
              <i className="bi bi-moon-stars-fill text-primary"></i>
            ) : (
              <i className="bi bi-sun-fill text-warning"></i>
            )}
          </button>

          <div className="topbar-avatar">
            <div className="avatar-fallback">
              <span>A</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
