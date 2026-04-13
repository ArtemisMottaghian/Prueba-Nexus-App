import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Topbar.css';

const TITLES = {
  '/': 'Dashboard',
  '/vacantes': 'Vacantes',
  '/clientes': 'Clientes',
};

export default function Topbar({ onMenuToggle, onActivityToggle }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();

  const pageTitle = TITLES[location.pathname] || 'Dashboard';

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (isDarkMode) {
      htmlElement.setAttribute('data-bs-theme', 'dark');
    } else {
      htmlElement.removeAttribute('data-bs-theme');
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
          <div className="topbar-search d-none d-md-flex">
            <i className="bi bi-search"></i>
            <input type="text" placeholder="Buscar vacantes..." />
          </div>

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

          <button
            className="btn-icon position-relative"
            onClick={onActivityToggle}
          >
            <i className="bi bi-bell"></i>
            <span className="notification-dot"></span>
          </button>

          <div className="topbar-avatar">
            <div className="avatar-fallback">
              <span>CM</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
