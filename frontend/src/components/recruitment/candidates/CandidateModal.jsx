import { useState } from 'react';
import { CANDIDATE_STATUS_SELECT_OPTIONS } from '../../../constants/candidateStatus';
import './CandidateModal.css';

export default function CandidateModal({
  candidate,
  onClose,
  onUpdateStatus,
  onToggleFavorite,
  onVerify,
}) {
  const [activeTab, setActiveTab] = useState('detalles');
  const [localStatus, setLocalStatus] = useState(() => candidate?.status || '');

  if (!candidate) return null;

  const handleSave = () => {
    onUpdateStatus(candidate.id, localStatus);
    onClose();
  };

  const handleVerify = () => {
    if (onVerify && !candidate.verified) onVerify(candidate.id);
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
                <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                  <span className="modal-subtitle">{candidate.specialty}</span>
                  {/* FIX 1: Tag Disponible ajustado al contenido */}
                  {candidate.isAvailable && (
                    <span
                      className="badge badge-client-sm d-inline-flex align-items-center"
                      style={{ width: 'fit-content', whiteSpace: 'nowrap' }}
                    >
                      Disponible
                    </span>
                  )}
                  {candidate.verified && (
                    <span className="badge bg-success-subtle text-success d-inline-flex align-items-center">
                      <i className="bi bi-patch-check-fill me-1" />
                      Verificado
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>

            <div className="modal-body">
              <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
                <select
                  className="form-select select-status-inline"
                  value={localStatus}
                  onChange={(e) => setLocalStatus(e.target.value)}
                >
                  {CANDIDATE_STATUS_SELECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {onVerify && !candidate.verified && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={handleVerify}
                  >
                    <i className="bi bi-patch-check me-1" />
<<<<<<< HEAD
                    Verificar candidato
=======
                    {candidate.verified ? 'Quitar' : 'Verificar candidato'}
>>>>>>> 78b3f22 (fix(candidatos): corregir formato en botón de verificación)
                  </button>
                )}
                <button
                  className={`btn-icon ${candidate.isFavorite ? 'text-warning' : ''}`}
                  onClick={() =>
                    onToggleFavorite(candidate.id, candidate.isFavorite)
                  }
                >
                  <i
                    className={
                      candidate.isFavorite ? 'bi bi-star-fill' : 'bi bi-star'
                    }
                  ></i>
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
                        {/* Campo Ubicación */}
                        <div className="detail-field d-flex align-items-start gap-3">
                          <div className="detail-icon icon-blue flex-shrink-0 mt-1">
                            <i className="bi bi-geo-alt"></i>
                          </div>
                          <div>
                            <div className="field-label">Ubicación</div>
                            <div className="field-value">
                              {candidate.location}
                            </div>
                          </div>
                        </div>

                        {/* FIX 2: Campo Experiencia con Icono protegido y texto que rompe líneas */}
                        <div className="detail-field d-flex align-items-start gap-3">
                          <div className="detail-icon icon-purple flex-shrink-0 mt-1">
                            <i className="bi bi-briefcase"></i>
                          </div>
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <div className="field-label">Experiencia</div>
                            <div
                              className="field-value text-break"
                              style={{ wordBreak: 'break-word' }}
                            >
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
