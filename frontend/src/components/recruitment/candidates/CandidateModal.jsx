import { useState } from 'react';
import './CandidateModal.css';

export default function CandidateModal({ candidate, onClose, onUpdateStatus }) {
  const [activeTab, setActiveTab] = useState('detalles');
  const [localStatus, setLocalStatus] = useState(candidate?.status || '');

  if (!candidate) return null;

  const handleSave = () => {
    onUpdateStatus(candidate.id, localStatus);
    onClose();
  };

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div className="flex-grow-1">
                <h2 className="modal-title">{candidate.name}</h2>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <span className="modal-subtitle">{candidate.specialty}</span>
                  {candidate.isAvailable && (
                    <span className="badge badge-client-sm">Disponible</span>
                  )}
                </div>
              </div>
              {/* CAMBIO AQUÍ: Quitamos btn-close-white */}
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>

            <div className="modal-body">
              <div className="d-flex align-items-center gap-3 mb-4">
                <select
                  className="form-select select-status-inline"
                  value={localStatus}
                  onChange={(e) => setLocalStatus(e.target.value)}
                >
                  <option value="Nuevo">Nuevo</option>
                  <option value="Contactado">Contactado</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Descartado">Descartado</option>
                </select>
                <button className="btn-icon">
                  <i className="bi bi-star"></i>
                </button>
              </div>

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
                            <i className="bi bi-geo-alt"></i>
                          </div>
                          <div>
                            <div className="field-label">Ubicación</div>
                            <div className="field-value">
                              {candidate.location}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-purple">
                            <i className="bi bi-briefcase"></i>
                          </div>
                          <div>
                            <div className="field-label">Experiencia</div>
                            <div className="field-value">
                              {candidate.experience || 'No especificada'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
