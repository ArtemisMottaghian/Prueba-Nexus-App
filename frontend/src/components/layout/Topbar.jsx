import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Topbar.css';

const TITLES = {
  '/': 'Dashboard',
  '/vacantes': 'Vacantes',
  '/clientes': 'Clientes',
};

export default function Topbar({ onMenuToggle, onActivityToggle }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = TITLES[location.pathname] || 'Dashboard';

  // Ejecuta la búsqueda al pulsar Enter
  const manejarBusqueda = (e) => {
    if (e.key === 'Enter') {
      navigate(`/vacantes?q=${encodeURIComponent(busqueda.trim())}`);
    }
  };

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
