import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  // 1. Función de Logout
  const handleLogout = () => {
    // Eliminamos el token del almacenamiento local
    localStorage.removeItem("token");
    // Cerramos el sidebar si esta el movil
    if (onClose) onClose();
    // Redirigimos al login
    navigate("/login");
  };

  return (
    <aside className={`ara-sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">N</div>
          <span>NexusAI</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <p className="section-title">Reclutamiento</p>
          <NavLink to="/" className="nav-item" onClick={onClose}>
            <span className="nav-icon">📊</span>
            Dashboard
          </NavLink>
          <NavLink to="/vacantes" className="nav-item" onClick={onClose}>
            <span className="nav-icon">💼</span>
            Vacantes
          </NavLink>
          <NavLink to="/candidatos" className="nav-item" onClick={onClose}>
            <span className="nav-icon">👥</span>
            Candidatos
          </NavLink>
        </div>

        <div className="nav-section">
          <p className="section-title">Gestión</p>
          <NavLink to="/clientes" className="nav-item" onClick={onClose}>
            <span className="nav-icon">🏢</span>
            Clientes (CRM)
          </NavLink>
          <NavLink to="/Calendar" className="nav-item" onClick={onClose}>
            <span className="nav-icon">📅</span>
            Calendario
          </NavLink>
        </div>
      </nav>

      {/* 2. Botón de Logout al final del Sidebar */}
      <div className="sidebar-footer">
        <button className="nav-item logout-btn" onClick={handleLogout}>
          <span className="nav-icon">🚪</span>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;