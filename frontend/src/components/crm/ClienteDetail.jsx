import { useState } from 'react';
import VacancyModal from '../recruitment/vacancies/VacancyModal';
import './ClienteDetail.css';

const getBadgeEstado = (estado) => {
  const map = {
    Nueva: 'badge-nueva',
    Contactada: 'badge-contactada',
    'En proceso': 'badge-en-proceso',
    Descartada: 'badge-descartada',
  };
  return map[estado] || 'badge-nueva';
};

export default function ClienteDetail({ cliente, onEdit, onDelete }) {
  const [vacanteSeleccionada, setVacanteSeleccionada] = useState(null);
  const [notaTexto, setNotaTexto] = useState('');
  const [notas, setNotas] = useState([]);
  const [activeTab, setActiveTab] = useState('info');

  const agregarNota = () => {
    if (!notaTexto.trim()) return;
    const nueva = {
      id: Date.now(),
      texto: notaTexto.trim(),
      fecha: new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setNotas((prev) => [nueva, ...prev]);
    setNotaTexto('');
  };

  if (!cliente) {
    return (
      <div className="clientes-empty-state">
        <div className="empty-icon-wrapper">
          <i className="bi bi-building-dash"></i>
        </div>
        <h4>Selecciona un cliente</h4>
        <p>Explora los datos, vacantes y notas de tus socios comerciales.</p>
      </div>
    );
  }

  return (
    <div className="cliente-detail-container">
      {/* HEADER SECTION */}
      <div className="cliente-profile-header mb-4">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="cliente-avatar">{cliente.nombre.charAt(0)}</div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h3 className="cliente-profile-nombre mb-0">
                  {cliente.nombre}
                </h3>
                {cliente.prioritario && (
                  <span className="badge-prioritario">VIP</span>
                )}
              </div>
              <span className="cliente-sector">{cliente.sector}</span>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={(e) => onEdit(e, cliente)}
            >
              <i className="bi bi-pencil me-1"></i> Editar
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={(e) => onDelete(e, cliente)}
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="cliente-stats-row mt-4">
          <div className="cliente-stat">
            <span className="stat-value stat-purple">
              {cliente.vacantesAbiertas}
            </span>
            <span className="stat-label">Abiertas</span>
          </div>
          <div className="cliente-stat">
            <span className="stat-value stat-cyan">
              {cliente.vacantes?.filter((v) => v.estado === 'Contactada')
                .length || 0}
            </span>
            <span className="stat-label">Contactos</span>
          </div>
          <div className="cliente-stat">
            <span className="stat-value stat-green">{notas.length}</span>
            <span className="stat-label">Notas</span>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="cliente-tabs mb-4">
        {[
          { id: 'info', label: 'Información', icon: 'info-circle' },
          {
            id: 'vacantes',
            label: 'Vacantes',
            icon: 'briefcase',
            count: cliente.vacantes?.length,
          },
          {
            id: 'notas',
            label: 'Notas',
            icon: 'journal-text',
            count: notas.length,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`cliente-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`bi bi-${tab.icon} me-2`}></i>
            {tab.label}
            {tab.count > 0 && (
              <span className="tab-badge ms-2">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="tab-body">
        {activeTab === 'info' && (
          <div className="row g-4">
            <div className="col-md-6">
              <div className="cliente-info-card">
                <h6 className="info-card-title">
                  <i className="bi bi-person-lines-fill me-2"></i>Contacto
                </h6>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Responsable</span>
                    <span className="info-value">
                      {cliente.contactoPrincipal}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Email</span>
                    <a
                      href={`mailto:${cliente.email}`}
                      className="info-value info-link text-decoration-none"
                    >
                      {cliente.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="cliente-info-card">
                <h6 className="info-card-title">
                  <i className="bi bi-geo-alt me-2"></i>Ubicación
                </h6>
                <div className="info-item">
                  <span className="info-label">Dirección</span>
                  <span className="info-value">
                    {cliente.direccion || 'No disponible'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vacantes' && (
          <div className="cliente-info-card">
            <h6 className="info-card-title">Listado de Vacantes</h6>
            {cliente.vacantes?.length > 0 ? (
              cliente.vacantes.map((v) => (
                <div
                  key={v.id}
                  className="vacante-vinculada d-flex justify-content-between align-items-center mb-2"
                >
                  <div>
                    <div className="vacante-vinculada-titulo">{v.titulo}</div>
                    <small className="text-muted">{v.fecha}</small>
                  </div>
                  <span className={`badge ${getBadgeEstado(v.estado)}`}>
                    {v.estado}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted">Sin vacantes vinculadas.</p>
            )}
          </div>
        )}

        {activeTab === 'notas' && (
          <div className="notas-section">
            <div className="cliente-info-card mb-4">
              <textarea
                className="nota-textarea mb-3"
                rows="3"
                placeholder="Escribe algo importante sobre este cliente..."
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
              />
              <div className="text-end">
                <button
                  className="btn-primary-custom"
                  onClick={agregarNota}
                  disabled={!notaTexto.trim()}
                >
                  Guardar Nota
                </button>
              </div>
            </div>
            <div className="notas-timeline">
              {notas.map((n) => (
                <div key={n.id} className="nota-item">
                  <div className="nota-dot"></div>
                  <div className="nota-content">
                    <p className="nota-texto mb-1">{n.texto}</p>
                    <small className="text-muted">{n.fecha}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {vacanteSeleccionada && (
        <VacancyModal
          job={vacanteSeleccionada}
          onClose={() => setVacanteSeleccionada(null)}
        />
      )}
    </div>
  );
}
