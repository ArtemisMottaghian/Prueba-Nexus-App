import { useState } from 'react';
import './VacancyModal.css';

export default function VacancyModal({ job, onClose, onUpdateStatus }) {
  const [activeTab, setActiveTab] = useState('detalles');
  const [localStatus, setLocalStatus] = useState(job?.status || '');

  if (!job) return null;

  const handleSave = () => {
    if (onUpdateStatus) onUpdateStatus(job.id, localStatus);
    onClose();
  };

  const getBadgeClass = (status) => {
    const map = {
      Nueva: 'badge-nueva',
      Contactada: 'badge-contactada',
      'En proceso': 'badge-en-proceso',
      Descartada: 'badge-descartada',
    };
    return map[status] || 'badge-nueva';
  };

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            {/* HEADER */}
            <div className="modal-header">
              <div className="flex-grow-1">
                <h2 className="modal-title">{job.title}</h2>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <i className="bi bi-building modal-header-icon"></i>
                  <span className="modal-subtitle">{job.companyName}</span>
                  {job.isClient && (
                    <span className="badge-client-sm">Cliente</span>
                  )}
                  <span className={`badge ${getBadgeClass(localStatus)} ms-1`}>
                    {localStatus}
                  </span>
                </div>
              </div>
              {/* Quitamos btn-close-white para soporte multi-tema */}
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>

            {/* BODY */}
            <div className="modal-body-scroll">
              <div className="d-flex align-items-center gap-3 mb-4">
                <select
                  className="form-select select-status-inline"
                  value={localStatus}
                  onChange={(e) => setLocalStatus(e.target.value)}
                >
                  <option value="Nueva">Nueva</option>
                  <option value="Contactada">Contactada</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Descartada">Descartada</option>
                </select>
                <button
                  className="btn-icon btn-star-toggle"
                  title="Marcar favorita"
                >
                  <i className="bi bi-star-fill"></i>
                </button>
              </div>

              {/* Tabs */}
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

              <div className="tab-content">
                {activeTab === 'detalles' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">Información General</h4>
                      <div className="detail-grid">
                        <div className="detail-field">
                          <div className="detail-icon icon-blue">
                            <i className="bi bi-geo-alt-fill"></i>
                          </div>
                          <div>
                            <div className="field-label">Ubicación</div>
                            <div className="field-value">
                              {job.location || 'No especificada'}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-purple">
                            <i className="bi bi-cash-stack"></i>
                          </div>
                          <div>
                            <div className="field-label">Salario</div>
                            <div className="field-value">
                              {job.salary || 'A convenir'}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-cyan">
                            <i className="bi bi-briefcase-fill"></i>
                          </div>
                          <div>
                            <div className="field-label">Fuente</div>
                            <div className="field-value">
                              {job.source || 'Nexus'}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-amber">
                            <i className="bi bi-clock-fill"></i>
                          </div>
                          <div>
                            <div className="field-label">Publicada</div>
                            <div className="field-value">{job.time || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4 className="section-title">Descripción del puesto</h4>
                      <div className="vacancy-description">
                        <p>
                          {job.description || 'No hay descripción disponible.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'seguimiento' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">Historial de actividad</h4>
                      {job.seguimiento?.length > 0 ? (
                        <div className="seguimiento-timeline">
                          {job.seguimiento.map((item, i) => (
                            <div key={i} className="seguimiento-item">
                              <div className="seguimiento-dot"></div>
                              <div className="seguimiento-card">
                                <p>{item.texto}</p>
                                <span className="activity-time">
                                  <i className="bi bi-clock me-1"></i>
                                  {item.fecha}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="tab-empty">
                          <i className="bi bi-list-check"></i>
                          <p>No hay actividad registrada aún.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'documentos' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">Archivos adjuntos</h4>
                      {job.documentos?.length > 0 ? (
                        job.documentos.map((doc, i) => (
                          <div key={i} className="doc-item">
                            <div className="doc-icon">
                              <i className="bi bi-file-earmark-text"></i>
                            </div>
                            <div className="flex-grow-1">
                              <div className="doc-name">{doc.nombre}</div>
                              <div className="doc-meta">
                                {doc.tipo} · {doc.fecha}
                              </div>
                            </div>
                            <button
                              className="btn-icon btn-icon-sm"
                              title="Descargar"
                            >
                              <i className="bi bi-download"></i>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="tab-empty">
                          <i className="bi bi-file-earmark"></i>
                          <p>No hay documentos adjuntos.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary-custom"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary-custom"
                onClick={handleSave}
              >
                <i className="bi bi-check-circle me-2"></i>Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
