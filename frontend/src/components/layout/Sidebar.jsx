import { NavLink, useNavigate } from 'react-router-dom';
// Asegúrate de que las rutas a los logos son correctas según tu proyecto
import logoNexus from '../../assets/logo-nexus.svg';
import isotipoNexus from '../../assets/isotipo-nexus.svg';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  // Función de Logout real (Traída de develop)
  const handleLogout = () => {
    // Eliminamos el token del almacenamiento local
    localStorage.removeItem('token');
    // Cerramos el sidebar si está en móvil
    if (onClose) onClose();
    // Redirigimos al login
    navigate('/login');
  };

  return (
    <>
      {/* Overlay: El fondo oscuro que cierra el menú al tocar fuera */}
      {isOpen && (
        <div className="sidebar-overlay d-lg-none" onClick={onClose}></div>
      )}

      <aside
        className={`ara-sidebar ${isOpen ? 'sidebar-open' : ''}`}
        id="sidebar"
      >
        <div className="sidebar-content">
          {/* Logo + Botón cerrar en móvil */}
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
            {/* GRUPO: VISIÓN GENERAL */}
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

            {/* GRUPO: RECLUTAMIENTO */}
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
            
            {/* GRUPO: COMUNICACIÓN */}
            <div className="sidebar-group">
              <div className="sidebar-group-header">COMUNICACIÓN</div>
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
          </nav>

          {/* FOOTER: Configuración y Logout */}
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
}>> develop
