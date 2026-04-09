import { NavLink, useNavigate } from 'react-router-dom';
import logoNexus from '../../assets/logo-nexus.svg';
import isotipoNexus from '../../assets/isotipo-nexus.svg';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
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
          <div className="sidebar-logo d-flex justify-content-between align-items-center px-3">
            <div className="logo-wrapper">
              <img
                src={isotipoNexus}
                alt="NexusAI Icon"
                className="logo-small"
              />
              <img src={logoNexus} alt="NexusAI Full" className="logo-large" />
            </div>
            <button
              className="btn-close-sidebar d-lg-none"
              onClick={onClose}
              aria-label="Cerrar menú"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <nav className="sidebar-nav">
            <div className="sidebar-group">
              <div className="sidebar-group-header">VISIÓN GENERAL</div>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <i className="bi bi-house"></i>
                <span className="sidebar-text">Inicio</span>
              </NavLink>
              <a href="#" className="sidebar-item">
                <i className="bi bi-bar-chart"></i>
                <span className="sidebar-text">Analítica</span>
              </a>
            </div>
            <div className="sidebar-group">
              <div className="sidebar-group-header">RECLUTAMIENTO</div>
              <NavLink
                to="/vacantes"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <i className="bi bi-briefcase"></i>
                <span className="sidebar-text">Vacantes</span>
              </NavLink>
              <NavLink
                to="/candidatos"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <i className="bi bi-people"></i>
                <span className="sidebar-text">Candidatos</span>
              </NavLink>
              <NavLink
                to="/clientes"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <i className="bi bi-building"></i>
                <span className="sidebar-text">Clientes</span>
              </NavLink>
            </div>
            <div className="sidebar-group">
              <div className="sidebar-group-header">COMUNICACIÓN</div>
              <a href="#" className="sidebar-item">
                <i className="bi bi-envelope"></i>
                <span className="sidebar-text">Inbox</span>
              </a>
              <NavLink
                to="/calendar"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <i className="bi bi-calendar-check"></i>
                <span className="sidebar-text">Calendario</span>
              </NavLink>
            </div>
            <div className="sidebar-group">
              <div className="sidebar-group-header">NEXUS ENGINE</div>
              <a href="#" className="sidebar-item">
                <i className="bi bi-stars"></i>
                <span className="sidebar-text">Smart Match</span>
              </a>
              <a href="#" className="sidebar-item">
                <i className="bi bi-robot"></i>
                <span className="sidebar-text">Scraping & Fuentes</span>
              </a>
            </div>
          </nav>
          <div className="flex-grow-1"></div>

          <div className="sidebar-footer px-2 pb-4">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              <i className="bi bi-gear"></i>
              <span className="sidebar-text">Configuración</span>
            </NavLink>
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
