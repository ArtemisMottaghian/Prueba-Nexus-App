import { useState, useEffect } from 'react';

export default function Topbar() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (isDarkMode) {
      htmlElement.setAttribute('data-bs-theme', 'dark');
      htmlElement.classList.remove('theme-light');
    } else {
      htmlElement.setAttribute('data-bs-theme', 'light');
      htmlElement.classList.add('theme-light');
    }
  }, [isDarkMode]);

  return (
    <header className="ara-topbar">
      <div className="topbar-content">
        
        <div className="d-flex align-items-center gap-3">
          <button className="btn-icon d-lg-none" id="menuToggle">
            <i className="bi bi-list"></i>
          </button>
          <h1 className="topbar-title">Dashboard</h1>
        </div>

        <div className="d-flex align-items-center gap-2 gap-md-3">
          <div className="topbar-search d-none d-md-flex">
            <i className="bi bi-search"></i>
            <input type="text" placeholder="Buscar vacantes..." />
          </div>

          {/* Icono del Sol corregido a text-warning para que sea amarillo */}
          <button 
            className="btn-icon" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Cambiar tema"
          >
            {isDarkMode ? (
              <i className="bi bi-sun-fill text-warning"></i> 
            ) : (
              <i className="bi bi-moon-stars-fill text-primary"></i>
            )}
          </button>

          <button className="btn-icon position-relative">
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