import { useState, useEffect } from 'react';
import VacancyModal from '../recruitment/vacancies/VacancyModal';
import CrmEmpresaPanel from './CrmEmpresaPanel';
import { updateEstadoCuenta } from '../../services/clientesService';
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
  companyName:
    cliente.name || cliente.company_name || cliente.nombre || 'Desconocido',
  location: cliente.address || cliente.direccion || 'No especificada',
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
  const [empresaCrm, setEmpresaCrm] = useState(cliente);

  useEffect(() => {
    setEmpresaCrm(cliente);
  }, [cliente]);

  const handleUpdateEstadoCuenta = async (nuevoEstado) => {
    if (!cliente) return;
    setEmpresaCrm((prev) => ({
      ...(prev || cliente),
      estadoCuenta: nuevoEstado,
    }));
    try {
      await updateEstadoCuenta(cliente.id, nuevoEstado);
    } catch (err) {
      console.error('Error actualizando estado de cuenta:', err);
    }
  };

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
  // PROTECCIÓN 2: Variable segura para el nombre en todo el detalle (Añadido cliente.name)
  const nombreParaMostrar =
    cliente.name || cliente.company_name || cliente.nombre || 'Desconocido';

  return (
    <>
      {/* Header con badge prioritario */}
      <div className="cliente-profile-header mb-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div className="d-flex align-items-start gap-3">
            {/* PROTECCIÓN 3: Avatar seguro */}
            <div className="cliente-avatar">
              {nombreParaMostrar.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h3 className="cliente-profile-nombre mb-0">
                  {/* PROTECCIÓN 4: Título seguro */}
                  {nombreParaMostrar}
                </h3>
                {esPrioritario && (
                  <span className="badge-prioritario">
                    <i className="bi bi-star-fill me-1"></i>VIP
                  </span>
                )}
                {empresaCrm?.estadoCuenta && (
                  <span
                    className={`estado-cuenta-chip estado-${
                      empresaCrm.estadoCuenta === 'en_negociacion'
                        ? 'negociacion'
                        : empresaCrm.estadoCuenta
                    }`}
                    title="Estado comercial de la cuenta"
                  >
                    {empresaCrm.estadoCuenta === 'en_negociacion'
                      ? 'En negociación'
                      : empresaCrm.estadoCuenta.charAt(0).toUpperCase() +
                        empresaCrm.estadoCuenta.slice(1)}
                  </span>
                )}
              </div>
              <span className="cliente-sector">
                {cliente.sector || 'Sin sector'}
                {empresaCrm?.responsable && (
                  <>
                    {' · '}
                    <i className="bi bi-person-circle me-1"></i>
                    Responsable: <strong>{empresaCrm.responsable}</strong>
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="cliente-vacantes-badge grande">
              {cliente.vacantesAbiertas || 0} vacantes abiertas
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
              {cliente.vacantesAbiertas || 0}
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
          className={`cliente-tab ${activeTab === 'crm' ? 'active' : ''}`}
          onClick={() => setActiveTab('crm')}
          title="Seguimiento comercial centralizado (empresa)"
        >
          <i className="bi bi-building-check me-2"></i>
          Seguimiento comercial
          {empresaCrm?.historialComercial?.length > 0 && (
            <span className="tab-badge">
              {empresaCrm.historialComercial.length}
            </span>
          )}
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

      {/* TAB: Seguimiento comercial (Issue #329) */}
      {activeTab === 'crm' && (
        <CrmEmpresaPanel
          empresa={empresaCrm}
          onUpdateEstadoCuenta={handleUpdateEstadoCuenta}
        />
      )}

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
                    {cliente.contactoPrincipal || '—'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Email</span>
                  <a
                    href={`mailto:${cliente.email}`}
                    className="info-value text-decoration-none info-link"
                  >
                    <i className="bi bi-envelope me-1"></i>
                    {cliente.email || '—'}
                  </a>
                </div>
                <div className="info-item">
                  <span className="info-label">Teléfono</span>
                  <a
                    href={`tel:${cliente.telefono}`}
                    className="info-value text-decoration-none info-link"
                  >
                    <i className="bi bi-telephone me-1"></i>
                    {cliente.telefono || '—'}
                  </a>
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                {cliente.email && (
                  <a
                    href={`mailto:${cliente.email}`}
                    className="btn btn-sm btn-contact"
                  >
                    <i className="bi bi-envelope me-1"></i>Email
                  </a>
                )}
                {cliente.telefono && (
                  <a
                    href={`tel:${cliente.telefono}`}
                    className="btn btn-sm btn-contact"
                  >
                    <i className="bi bi-telephone me-1"></i>Llamar
                  </a>
                )}
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
                  {/* PROTECCIÓN: Añadido cliente.address */}
                  <span className="info-value">
                    {cliente.address || cliente.direccion || '—'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Sector</span>
                  <span className="info-value">{cliente.sector || '—'}</span>
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

      {/* TAB: Notas */}
      {activeTab === 'notas' && (
        <div>
          <div className="cliente-info-card mb-3">
            <h6 className="info-card-title mb-3">
              <i className="bi bi-plus-circle me-2"></i>Nueva nota
            </h6>
            <textarea
              className="nota-textarea mb-2"
              rows="3"
              placeholder="Escribe una nota sobre este cliente..."
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) agregarNota();
              }}
            />
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted" style={{ fontSize: '11px' }}>
                Ctrl+Enter para guardar
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={agregarNota}
                disabled={!notaTexto.trim()}
              >
                <i className="bi bi-plus me-1"></i>Añadir nota
              </button>
            </div>
          </div>

          {notas.length > 0 ? (
            <div className="notas-timeline">
              {notas.map((nota) => (
                <div key={nota.id} className="nota-item">
                  <div className="nota-dot"></div>
                  <div className="nota-content">
                    <div className="d-flex justify-content-between align-items-start">
                      <p className="nota-texto mb-1">{nota.texto}</p>
                      <button
                        className="btn-icon btn-icon-sm ms-2 flex-shrink-0"
                        onClick={() => eliminarNota(nota.id)}
                        title="Eliminar nota"
                      >
                        <i
                          className="bi bi-trash text-danger"
                          style={{ fontSize: '12px' }}
                        ></i>
                      </button>
                    </div>
                    <span className="activity-time">
                      <i className="bi bi-clock me-1"></i>
                      {nota.fecha}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted py-4">
              <i className="bi bi-journal-text fs-3 d-block mb-2"></i>
              <p className="mb-0">No hay notas para este cliente</p>
            </div>
          )}
        </div>
      )}

      {/* Modal vacante */}
      {vacanteSeleccionada && (
        <VacancyModal
          job={vacanteSeleccionada}
          onClose={() => setVacanteSeleccionada(null)}
        />
      )}
    </>
  );
}
