import { useState } from 'react';

// 1. Añadimos onUpdateStatus a las props
export default function VacancyModal({ job, onClose, onUpdateStatus }) {
  const [activeTab, setActiveTab] = useState('detalles');
  
  // 2. Estado local para el nuevo status (por si el usuario cambia de opinión antes de guardar)
  const [localStatus, setLocalStatus] = useState(job?.status || '');

  if (!job) return null;

  // 3. Función para guardar y cerrar
  const handleSave = () => {
    onUpdateStatus(job.id, localStatus);
    onClose(); // Cerramos el modal tras guardar
  };

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            
            <div className="modal-header">
              <div className="flex-grow-1">
                <h2 className="modal-title">{job.title}</h2>
                <p className="text-muted small mb-0">{job.companyName} · {job.location}</p>
              </div>
              <button type="button" className="btn-icon" onClick={onClose}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body">
              {/* --- Select de Estado Controlado --- */}
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
                <button className="btn-icon">
                  <i className="bi bi-star"></i>
                </button>
              </div>

              {/* Tabs (Detalles, Seguimiento, etc) */}
              <ul className="nav nav-tabs mb-4">
                <li className="nav-item">
                  <button className={`nav-link ${activeTab === 'detalles' ? 'active' : ''}`} onClick={() => setActiveTab('detalles')}>
                    <i className="bi bi-info-circle me-2"></i>Detalles
                  </button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link ${activeTab === 'seguimiento' ? 'active' : ''}`} onClick={() => setActiveTab('seguimiento')}>
                    <i className="bi bi-list-check me-2"></i>Seguimiento
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
                          <div className="detail-icon icon-purple"><i className="bi bi-building"></i></div>
                          <div>
                            <div className="field-label">Empresa</div>
                            <div className="field-value">{job.companyName}</div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-cyan"><i className="bi bi-geo-alt"></i></div>
                          <div>
                            <div className="field-label">Ubicación</div>
                            <div className="field-value">{job.location}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* ... resto de tus pestañas ... */}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              {/* 4. Conectamos el botón de Guardar */}
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
