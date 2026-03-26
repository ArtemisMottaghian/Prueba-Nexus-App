import { useState } from 'react';
import VacancyModal from '../recruitment/VacancyModal';
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

const adaptarVacante = (vacante, cliente) => ({
  id: vacante.id,
  title: vacante.titulo,
  companyName: cliente.nombre,
  location: cliente.direccion || 'No especificada',
  status: vacante.estado,
  source: 'Nexus',
  time: vacante.fecha,
  salary: null,
});

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
      fecha: new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setNotas((prev) => [nueva, ...prev]);
    setNotaTexto('');
  };

  const eliminarNota = (id) =>
    setNotas((prev) => prev.filter((n) => n.id !== id));

  if (!cliente) {
    return (
      <div className="clientes-empty-state">
        <div className="empty-icon-wrapper">
          <i className="bi bi-building"></i>
        </div>
        <h5>Selecciona un cliente</h5>
        <p className="text-muted">
          Haz clic en un cliente de la lista para ver sus datos y vacantes
          asociadas.
        </p>
      </div>
    );
  }

  const esPrioritario = cliente.prioritario || false;

  return (
    <>
      {/* Header con badge prioritario */}
      <div className="cliente-profile-header mb-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div className="d-flex align-items-start gap-3">
            <div className="cliente-avatar">{cliente.nombre.charAt(0)}</div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h3 className="cliente-profile-nombre mb-0">
                  {cliente.nombre}
                </h3>
                {esPrioritario && (
                  <span className="badge-prioritario">
                    <i className="bi bi-star-fill me-1"></i>VIP
                  </span>
                )}
              </div>
              <span className="cliente-sector">{cliente.sector}</span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="cliente-vacantes-badge grande">
              {cliente.vacantesAbiertas} vacantes abiertas
            </span>
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={(e) => onEdit(e, cliente)}
            >
              <i className="bi bi-pencil"></i>
              <span className="d-none d-sm-inline">Editar</span>
            </button>
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={(e) => onDelete(e, cliente)}
            >
              <i className="bi bi-trash"></i>
              <span className="d-none d-sm-inline">Eliminar</span>
            </button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="cliente-stats-row mt-3">
          <div className="cliente-stat">
            <span className="stat-value stat-purple">
              {cliente.vacantesAbiertas}
            </span>
            <span className="stat-label">Vacantes activas</span>
          </div>
          <div className="cliente-stat">
            <span className="stat-value stat-cyan">
              {cliente.vacantes?.filter((v) => v.estado === 'Contactada')
                .length || 0}
            </span>
            <span className="stat-label">Contactadas</span>
          </div>
          <div className="cliente-stat">
            <span className="stat-value stat-amber">
              {cliente.vacantes?.filter((v) => v.estado === 'En proceso')
                .length || 0}
            </span>
            <span className="stat-label">En proceso</span>
          </div>
          <div className="cliente-stat">
            <span className="stat-value stat-green">{notas.length}</span>
            <span className="stat-label">Notas</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="cliente-tabs mb-4">
        <button
          className={`cliente-tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <i className="bi bi-info-circle me-2"></i>Información
        </button>
        <button
          className={`cliente-tab ${activeTab === 'vacantes' ? 'active' : ''}`}
          onClick={() => setActiveTab('vacantes')}
        >
          <i className="bi bi-briefcase me-2"></i>
          Vacantes
          {cliente.vacantes?.length > 0 && (
            <span className="tab-badge">{cliente.vacantes.length}</span>
          )}
        </button>
        <button
          className={`cliente-tab ${activeTab === 'notas' ? 'active' : ''}`}
          onClick={() => setActiveTab('notas')}
        >
          <i className="bi bi-journal-text me-2"></i>
          Notas
          {notas.length > 0 && (
            <span className="tab-badge">{notas.length}</span>
          )}
        </button>
      </div>

      {/* TAB: Información */}
      {activeTab === 'info' && (
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="cliente-info-card h-100">
              <h6 className="info-card-title">
                <i className="bi bi-person-badge me-2"></i>Datos de contacto
              </h6>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Contacto principal</span>
                  <span className="info-value">
                    {cliente.contactoPrincipal}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Email</span>
                  <a
                    href={`mailto:${cliente.email}`}
                    className="info-value text-decoration-none info-link"
                  >
                    <i className="bi bi-envelope me-1"></i>
                    {cliente.email}
                  </a>
                </div>
                <div className="info-item">
                  <span className="info-label">Teléfono</span>
                  <a
                    href={`tel:${cliente.telefono}`}
                    className="info-value text-decoration-none info-link"
                  >
                    <i className="bi bi-telephone me-1"></i>
                    {cliente.telefono}
                  </a>
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <a
                  href={`mailto:${cliente.email}`}
                  className="btn btn-sm btn-contact"
                >
                  <i className="bi bi-envelope me-1"></i>Email
                </a>
                <a
                  href={`tel:${cliente.telefono}`}
                  className="btn btn-sm btn-contact"
                >
                  <i className="bi bi-telephone me-1"></i>Llamar
                </a>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="cliente-info-card h-100">
              <h6 className="info-card-title">
                <i className="bi bi-building me-2"></i>Datos fiscales
              </h6>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">CIF</span>
                  <span className="info-value">{cliente.cif || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Dirección</span>
                  <span className="info-value">{cliente.direccion || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Sector</span>
                  <span className="info-value">{cliente.sector}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Vacantes */}
      {activeTab === 'vacantes' && (
        <div className="cliente-info-card">
          <h6 className="info-card-title mb-3">
            <i className="bi bi-briefcase me-2"></i>
            Vacantes vinculadas ({cliente.vacantes?.length || 0})
          </h6>
          {cliente.vacantes?.length > 0 ? (
            cliente.vacantes.map((v) => (
              <div
                key={v.id}
                className="vacante-vinculada d-flex align-items-center justify-content-between mb-2"
                onClick={() =>
                  setVacanteSeleccionada(adaptarVacante(v, cliente))
                }
              >
                <div>
                  <p className="mb-0 vacante-vinculada-titulo">{v.titulo}</p>
                  <span className="activity-time">
                    <i className="bi bi-clock me-1"></i>
                    {v.fecha}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${getBadgeEstado(v.estado)}`}>
                    {v.estado}
                  </span>
                  <i
                    className="bi bi-chevron-right text-muted"
                    style={{ fontSize: '12px' }}
                  ></i>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted small mb-0">No hay vacantes vinculadas.</p>
          )}
        </div>
      )}