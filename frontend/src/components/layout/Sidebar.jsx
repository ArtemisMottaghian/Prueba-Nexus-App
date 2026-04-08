import { NavLink, useNavigate } from 'react-router-dom';
import logoNexus from '../../assets/logo-nexus.svg';
import isotipoNexus from '../../assets/isotipo-nexus.svg';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  // Lógica de Logout rescatada del primer código
  const handleLogout = () => {
    localStorage.removeItem('token');
    if (onClose) onClose();
    navigate('/login');
  };

  // Función auxiliar para manejar las clases activas de forma limpia
  const navAction = ({ isActive }) =>
    `sidebar-item ${isActive ? 'active' : ''}`;

  return (
    <>
      {/* Overlay: UX mejorada para móviles */}
      {isOpen && (
        <div className="sidebar-overlay d-lg-none" onClick={onClose}></div>
      )}

      <aside
        className={`ara-sidebar ${isOpen ? 'sidebar-open' : ''}`}
        id="sidebar"
      >
        <div className="sidebar-content">
          {/* HEADER: Logo y Botón de cierre móvil */}
          <div className="sidebar-logo d-flex justify-content-between align-items-center px-3">
            <div className="logo-wrapper">
              <img src={isotipoNexus} alt="Icon" className="logo-small" />
              <img src={logoNexus} alt="NexusAI Full" className="logo-large" />
            </div>
            <button className="btn-close-sidebar d-lg-none" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* CUERPO: Navegación Organizada */}
          <nav className="sidebar-nav">
            <div className="sidebar-group">
              <div className="sidebar-group-header">VISIÓN GENERAL</div>
              <NavLink to="/" end className={navAction} onClick={onClose}>
                <i className="bi bi-house"></i>
                <span className="sidebar-text">Inicio</span>
              </NavLink>
              <NavLink to="/dashboard" className={navAction} onClick={onClose}>
                <i className="bi bi-bar-chart"></i>
                <span className="sidebar-text">Analítica</span>
              </NavLink>
            </div>

            <div className="sidebar-group">
              <div className="sidebar-group-header">RECLUTAMIENTO</div>
              <NavLink to="/vacantes" className={navAction} onClick={onClose}>
                <i className="bi bi-briefcase"></i>
                <span className="sidebar-text">Vacantes</span>
              </NavLink>
              <NavLink to="/candidatos" className={navAction} onClick={onClose}>
                <i className="bi bi-people"></i>
                <span className="sidebar-text">Candidatos</span>
              </NavLink>
              <NavLink to="/clientes" className={navAction} onClick={onClose}>
                <i className="bi bi-building"></i>
                <span className="sidebar-text">Clientes</span>
              </NavLink>
            </div>

            <div className="sidebar-group">
              <div className="sidebar-group-header">COMUNICACIÓN</div>
              <NavLink to="/calendar" className={navAction} onClick={onClose}>
                <i className="bi bi-calendar-check"></i>
                <span className="sidebar-text">Calendario</span>
              </NavLink>
            </div>
          </nav>

          <div className="flex-grow-1"></div>

          {/* FOOTER: Configuración y Logout */}
          <div className="sidebar-footer">
            <NavLink to="/settings" className={navAction} onClick={onClose}>
              <i className="bi bi-gear"></i>
              <span className="sidebar-text">Configuración</span>
            </NavLink>
            <button
              className="sidebar-item logout-btn-link"
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
