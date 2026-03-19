import { NavLink } from 'react-router-dom';
import logoNexus from '../../assets/logo-nexus.svg'; 
import isotipoNexus from '../../assets/isotipo-nexus.svg';

export default function Sidebar() {
  return (
    <aside className="ara-sidebar" id="sidebar">
      <div className="sidebar-content">

        
        <div className="sidebar-logo">
          <img src={isotipoNexus} alt="NexusAI Icon" className="logo-small" />
          <img src={logoNexus} alt="NexusAI Full" className="logo-large" />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          
          {/* VISIÓN GENERAL */}
          <div className="sidebar-group">
            <div className="sidebar-group-header">VISIÓN GENERAL</div>
            
            <NavLink to="/" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`} title="Inicio">
              <i className="bi bi-house"></i>
              <span className="sidebar-text">Inicio</span>
            </NavLink>
            
            <a href="#" className="sidebar-item" title="Analítica">
              <i className="bi bi-bar-chart"></i>
              <span className="sidebar-text">Analítica</span>
            </a>
          </div>

          {/* RECLUTAMIENTO */}
          <div className="sidebar-group">
            <div className="sidebar-group-header">RECLUTAMIENTO</div>
            
            <NavLink to="/vacantes" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`} title="Vacantes">
              <i className="bi bi-briefcase"></i>
              <span className="sidebar-text">Vacantes</span>
              <span className="sidebar-badge">12</span>
            </NavLink>
            
            <a href="#" className="sidebar-item" title="Candidatos">
              <i className="bi bi-people"></i>
              <span className="sidebar-text">Candidatos</span>
            </a>
            <a href="#" className="sidebar-item" title="Empresas">
              <i className="bi bi-building"></i>
              <span className="sidebar-text">Empresas</span>
            </a>
          </div>

          {/* COMUNICACIÓN */}
          <div className="sidebar-group">
            <div className="sidebar-group-header">COMUNICACIÓN</div>
            <a href="#" className="sidebar-item" title="Inbox">
              <i className="bi bi-envelope"></i>
              <span className="sidebar-text">Inbox</span>
              <span className="sidebar-badge">5</span>
            </a>
            
            {/*CALENDARIO */}
            <NavLink to="/calendar" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`} title="Calendario">
              <i className="bi bi-calendar-check"></i>
              <span className="sidebar-text">Calendario</span>
            </NavLink>
          </div>

          {/* NEXUS ENGINE */}
          <div className="sidebar-group">
            <div className="sidebar-group-header">NEXUS ENGINE</div>
            <a href="#" className="sidebar-item" title="Smart Match">
              <i className="bi bi-stars"></i>
              <span className="sidebar-text">Smart Match</span>
            </a>
            <a href="#" className="sidebar-item" title="Scraping & Fuentes">
              <i className="bi bi-robot"></i>
              <span className="sidebar-text">Scraping & Fuentes</span>
            </a>
          </div>

        </nav>

        <div className="flex-grow-1"></div>

        <div className="sidebar-footer">
          <a href="#" className="sidebar-item" title="Configuración">
            <i className="bi bi-gear"></i>
            <span className="sidebar-text">Configuración</span>
          </a>
        </div>
        
      </div>
    </aside>
  );
}