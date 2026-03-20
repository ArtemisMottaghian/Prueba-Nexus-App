import { useState } from 'react';

export default function VacancyModal({ job, onClose }) {
  // 1. Estado para controlar la pestaña activa
  const [activeTab, setActiveTab] = useState('detalles');

  if (!job) return null;

  return (
    <>
      {/* Fondo oscuro */}
      <div className="modal-backdrop fade show"></div>

      {/* Estructura del Modal */}
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            {/* Header */}
            <div className="modal-header">
              <div className="flex-grow-1">
                <h2 className="modal-title">{job.title}</h2>
                <p className="text-muted small mb-0">
                  {job.companyName} · {job.location}
                </p>
              </div>
              <button type="button" className="btn-icon" onClick={onClose}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {/* Estado y Favorito */}
              <div className="d-flex align-items-center gap-3 mb-4">
                <select
                  className="form-select select-status-inline"
                  defaultValue={job.status}
                >
                  <option value="Nueva">Nueva</option>
                  <option value="Contactada">Contactada</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Descartada">Descartada</option>
                </select>
                <button className="btn-icon">
                  <i className="bi bi-star"></i>
                </button>
              </div>

              {/* Tabs dinámicas */}
              <ul className="nav nav-tabs mb-4">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'detalles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('detalles')}
                  >
                    <i className="bi bi-info-circle me-2"></i>Detalles
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'seguimiento' ? 'active' : ''}`}
                    onClick={() => setActiveTab('seguimiento')}
                  >
                    <i className="bi bi-list-check me-2"></i>Seguimiento
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'documentos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('documentos')}
                  >
                    <i className="bi bi-file-earmark me-2"></i>Documentos
                  </button>
                </li>
              </ul>

              {/* Contenido de las Pestañas */}
              <div className="tab-content">
                {/* --- Tab: Detalles --- */}
                {activeTab === 'detalles' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">Información General</h4>
                      <div className="detail-grid">
                        <div className="detail-field">
                          <div className="detail-icon icon-purple">
                            <i className="bi bi-building"></i>
                          </div>
                          <div>
                            <div className="field-label">Empresa</div>
                            <div className="field-value">{job.companyName}</div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-cyan">
                            <i className="bi bi-geo-alt"></i>
                          </div>
                          <div>
                            <div className="field-label">Ubicación</div>
                            <div className="field-value">{job.location}</div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-purple">
                            <i className="bi bi-cash"></i>
                          </div>
                          <div>
                            <div className="field-label">Salario</div>
                            <div className="field-value">
                              {job.salary || 'A convenir'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="detail-section">
                      <h4 className="section-title">Descripción del puesto</h4>
                      <p className="section-text">
                        Buscamos un perfil Senior para integrarse en el equipo
                        de desarrollo...
                      </p>
                    </div>
                    <div className="detail-section">
                      <h4 className="section-title">Origen</h4>
                      <div className="origin-badge-large">
                        <i
                          className={`bi bi-${job.source?.toLowerCase() === 'linkedin' ? 'linkedin' : 'search'}`}
                        ></i>
                        <span>Capturado desde {job.source}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- Tab: Seguimiento --- */}
                {activeTab === 'seguimiento' && (
                  <div className="tab-pane fade show active">
                    <div className="add-note-section mb-4">
                      <h4 className="section-title">Agregar nota</h4>
                      <textarea
                        className="form-control mb-3"
                        rows="3"
                        placeholder="Escribe una nota..."
                      ></textarea>
                      <button className="btn btn-primary">
                        <i className="bi bi-plus-circle me-2"></i> Agregar nota
                      </button>
                    </div>
                    <div className="timeline-section">
                      <h4 className="section-title">Historial</h4>
                      <div className="timeline-item">
                        <div className="timeline-marker marker-purple">
                          <i className="bi bi-plus-circle"></i>
                        </div>
                        <div className="timeline-content">
                          <p className="timeline-title">Vacante capturada</p>
                          <p className="timeline-desc">Desde {job.source}</p>
                          <span className="timeline-time">
                            {job.time} · Sistema
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- Tab: Documentos --- */}
                {activeTab === 'documentos' && (
                  <div className="tab-pane fade show active">
                    <div className="documents-section">
                      <h4 className="section-title mb-3">
                        Documentos adjuntos
                      </h4>
                      <div className="document-item">
                        <div className="document-icon">
                          <i className="bi bi-file-earmark-pdf"></i>
                        </div>
                        <div className="document-info">
                          <p className="document-name">
                            job_description_{job.id}.pdf
                          </p>
                          <p className="document-meta">
                            Generado por Nexus Engine
                          </p>
                        </div>
                        <button className="btn-icon">
                          <i className="bi bi-download"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cerrar
              </button>
              <button type="button" className="btn btn-primary">
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
