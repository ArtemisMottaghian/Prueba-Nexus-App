import { useState } from 'react';
import { CANDIDATE_STATUS_SELECT_OPTIONS } from '../../../constants/candidateStatus';
import { ENDPOINTS } from '../../../services/api';
import './CandidateModal.css';

// Parte el texto de un apartado del CV en entradas: una por salto de linea
// (o por comas fuera de parentesis, p. ej. idiomas: "Espaniol (nativo), Ingles (C1)")
const cvItems = (text, { commas = false } = {}) => {
  if (!text) return [];
  const sep = commas ? /\n+|,(?![^(]*\))/ : /\n+/;
  return text
    .split(sep)
    .map((s) => s.replace(/^[-–—•·▪]\s*/, '').trim())
    .filter(Boolean);
};

// Pinta un apartado del CV: lista con puntos si hay varias entradas,
// texto normal si solo hay una (o el texto antiguo sin saltos de linea)
function CvList({ text, empty, commas = false }) {
  const items = cvItems(text, { commas });
  if (items.length === 0) return empty;
  if (items.length === 1) return items[0];
  return (
    <ul className="cv-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function CandidateModal({
  candidate,
  onClose,
  onUpdateStatus,
  onToggleFavorite,
  onVerify,
  onDeleteCandidate,
  onEditCandidate,
}) {
  const [activeTab, setActiveTab] = useState('detalles');
  const [localStatus, setLocalStatus] = useState(() => candidate?.status || '');

  // Seguimiento candidato
  const [candidatosList, setCandidatosList] = useState(
    candidate?.candidatos || []
  );
  const [candForm, setCandForm] = useState({
    fase: 'Enviado CV',
    resultado: 'Pendiente',
    notas: '',
  });

  // Documentos locales
  const [localDocs, setLocalDocs] = useState(candidate?.documentos || []);
  const [docTipo, setDocTipo] = useState('');
  const [draggingOver, setDraggingOver] = useState(false);

  if (!candidate) return null;

  const metaEnlace = (url) =>
    /linkedin/i.test(url)
      ? { label: 'Perfil de LinkedIn', icon: 'bi-linkedin' }
      : /github/i.test(url)
        ? { label: 'GitHub', icon: 'bi-github' }
        : { label: 'Portfolio / Web', icon: 'bi-globe' };

  const enlaces = [
    candidate.linkedinUrl,
    candidate.githubUrl,
    candidate.portfolioUrl,
    candidate.candidateUrl,
  ].filter(Boolean);

  const habilidades = (candidate.specialty || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'N/A' && s !== 'Sin especificar');

  const handleSave = () => {
    onUpdateStatus(candidate.id, localStatus);
    onClose();
  };

  const handleVerify = () => {
    if (onVerify) onVerify(candidate.id, !candidate.verified);
  };

  const handleAddCandidato = () => {
    const nuevo = {
      ...candForm,
      fecha: new Date().toLocaleDateString('es-ES'),
    };
    setCandidatosList((prev) => [nuevo, ...prev]);
    setCandForm({
      fase: 'Enviado CV',
      resultado: 'Pendiente',
      notas: '',
    });
  };

  const handleAdjuntarArchivos = (files) => {
    if (!files?.length) return;
    if (!docTipo) {
      alert('Selecciona primero el tipo de documento.');
      return;
    }
    const nuevos = Array.from(files).map((f) => ({
      nombre: f.name,
      tipo: docTipo,
      fecha: new Date().toLocaleDateString('es-ES'),
      tamaño:
        f.size > 1024 * 1024
          ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
          : `${(f.size / 1024).toFixed(0)} KB`,
    }));
    setLocalDocs((prev) => [...nuevos, ...prev]);
  };

  const handleEliminarDoc = (index) => {
    setLocalDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const getDocIcon = (nombre) => {
    const ext = nombre.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'bi-file-earmark-pdf text-danger';
    if (['doc', 'docx'].includes(ext))
      return 'bi-file-earmark-word text-primary';
    if (['xls', 'xlsx'].includes(ext))
      return 'bi-file-earmark-excel text-success';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext))
      return 'bi-file-earmark-image text-info';
    return 'bi-file-earmark-text';
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
                  <span className="modal-subtitle">
                    {candidate.profile || candidate.specialty}
                  </span>
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
                  onChange={(e) => {
                    // Se guarda al momento, sin esperar a "Guardar cambios"
                    setLocalStatus(e.target.value);
                    onUpdateStatus(candidate.id, e.target.value);
                  }}
                >
                  {CANDIDATE_STATUS_SELECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {onVerify && (
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      candidate.verified
                        ? 'btn-outline-danger'
                        : 'btn-outline-primary'
                    }`}
                    onClick={handleVerify}
                  >
                    <i className="bi bi-patch-check me-1" />
                    {candidate.verified ? 'Quitar' : 'Verificar candidato'}
                  </button>
                )}

                {/* --- ZONA DE ICONOS (ESTRELLA, EDITAR, ELIMINAR) --- */}
                <div className="d-flex align-items-center gap-1 border-start ps-3 ms-1">
                  {/* Favorito */}
                  <button
                    className={`btn-icon ${candidate.isFavorite ? 'text-warning' : ''}`}
                    onClick={() =>
                      onToggleFavorite(candidate.id, candidate.isFavorite)
                    }
                    title="Favorito"
                  >
                    <i
                      className={
                        candidate.isFavorite ? 'bi bi-star-fill' : 'bi bi-star'
                      }
                    ></i>
                  </button>

                  {/* Editar  */}
                  <button
                    className="btn-icon text-secondary hover-primary ms-1"
                    onClick={() => {
                      if (onEditCandidate) {
                        onEditCandidate(candidate);
                        onClose();
                      } else {
                        alert(
                          'Falta conectar la función de Editar en CandidateGrid'
                        );
                      }
                    }}
                    title="Editar candidato"
                  >
                    <i className="bi bi-pencil-square fs-5"></i>
                  </button>

                  {/* Eliminar  */}
                  <button
                    className="btn-icon text-secondary hover-danger ms-1"
                    onClick={() => {
                      if (onDeleteCandidate) {
                        onDeleteCandidate(candidate.id);
                        onClose();
                      } else {
                        alert(
                          'Falta conectar la función de Borrar en CandidateGrid'
                        );
                      }
                    }}
                    title="Eliminar candidato"
                  >
                    <i className="bi bi-trash3 fs-5"></i>
                  </button>
                </div>
                {/* -------------------------------------------------- */}
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
                    className={`nav-link ${activeTab === 'candidatos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('candidatos')}
                  >
                    <i className="bi bi-people-fill me-2"></i>Seguimiento
                    candidato
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
                    <div className="detail-section mb-4">
                      {enlaces.length > 0 ? (
                        <div className="detail-grid">
                          {enlaces.map((url) => {
                            const meta = metaEnlace(url);
                            return (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="detail-field d-flex align-items-center gap-3"
                                style={{ textDecoration: 'none' }}
                              >
                                <div className="detail-icon icon-purple flex-shrink-0">
                                  <i className={`bi ${meta.icon}`}></i>
                                </div>
                                <div
                                  className="flex-grow-1"
                                  style={{ minWidth: 0 }}
                                >
                                  <div className="field-label">
                                    {meta.label}
                                  </div>
                                  <div className="field-value text-break">
                                    {url}
                                  </div>
                                </div>
                                <i className="bi bi-box-arrow-up-right text-muted"></i>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          className="detail-field d-flex align-items-center gap-3 text-muted"
                          style={{ borderStyle: 'dashed' }}
                        >
                          <div className="detail-icon icon-purple flex-shrink-0">
                            <i className="bi bi-link-45deg"></i>
                          </div>
                          <div className="field-value">
                            Sin enlaces (portfolio, LinkedIn…)
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="detail-section mb-4">
                      <h4 className="section-title">Información personal</h4>
                      <div className="detail-grid">
                        <div className="detail-field d-flex align-items-start gap-3">
                          <div className="detail-icon icon-blue flex-shrink-0 mt-1">
                            <i className="bi bi-geo-alt"></i>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="field-label">Ubicación</div>
                            <div className="field-value">
                              {candidate.location || 'No especificada'}
                            </div>
                          </div>
                        </div>

                        <div className="detail-field d-flex align-items-start gap-3">
                          <div className="detail-icon icon-purple flex-shrink-0 mt-1">
                            <i className="bi bi-telephone"></i>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="field-label">Teléfono</div>
                            <div className="field-value">
                              {candidate.phone || 'No indicado'}
                            </div>
                          </div>
                        </div>

                        <div className="detail-field d-flex align-items-start gap-3">
                          <div className="detail-icon icon-blue flex-shrink-0 mt-1">
                            <i className="bi bi-envelope"></i>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="field-label">Email</div>
                            <div className="field-value text-break">
                              {candidate.email || 'No indicado'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="detail-section mb-4">
                      <h4 className="section-title">Experiencia profesional</h4>
                      <div className="detail-field d-flex align-items-start gap-3">
                        <div className="detail-icon icon-purple flex-shrink-0 mt-1">
                          <i className="bi bi-briefcase"></i>
                        </div>
                        <div
                          className="field-value text-break flex-grow-1"
                          style={{ whiteSpace: 'pre-line', minWidth: 0 }}
                        >
                          <CvList
                            text={candidate.experience}
                            empty="No especificada"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="detail-section mb-4">
                      <h4 className="section-title">Formación académica</h4>
                      <div className="detail-field d-flex align-items-start gap-3">
                        <div className="detail-icon icon-blue flex-shrink-0 mt-1">
                          <i className="bi bi-mortarboard"></i>
                        </div>
                        <div
                          className="field-value text-break flex-grow-1"
                          style={{ whiteSpace: 'pre-line', minWidth: 0 }}
                        >
                          <CvList
                            text={candidate.education}
                            empty="No especificada"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4 className="section-title">Idiomas</h4>
                      <div className="detail-field d-flex align-items-start gap-3">
                        <div className="detail-icon icon-blue flex-shrink-0 mt-1">
                          <i className="bi bi-translate"></i>
                        </div>
                        <div
                          className="field-value text-break flex-grow-1"
                          style={{ whiteSpace: 'pre-line', minWidth: 0 }}
                        >
                          <CvList
                            text={candidate.languages}
                            empty="No especificados"
                            commas
                          />
                        </div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4 className="section-title">Habilidades</h4>
                      <div className="detail-field d-flex align-items-start gap-3">
                        <div className="detail-icon icon-purple flex-shrink-0 mt-1">
                          <i className="bi bi-tools"></i>
                        </div>
                        <div
                          className="field-value flex-grow-1"
                          style={{ minWidth: 0 }}
                        >
                          {habilidades.length > 0 ? (
                            <div className="skill-chips">
                              {habilidades.map((h, i) => (
                                <span key={i} className="skill-chip">
                                  {h}
                                </span>
                              ))}
                            </div>
                          ) : (
                            'No especificadas'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'candidatos' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">Seguimiento del proceso</h4>

                      <div className="cand-tracking-form mb-4">
                        <div className="cand-form-row">
                          <div className="cand-form-field">
                            <label className="field-label">
                              TIPO DE ENTREVISTA / FASE
                            </label>
                            <select
                              className="form-select input-field"
                              value={candForm.fase}
                              onChange={(e) =>
                                setCandForm((f) => ({
                                  ...f,
                                  fase: e.target.value,
                                }))
                              }
                            >
                              <option>Enviado CV</option>
                              <option>Entrevista telefónica</option>
                              <option>Primera entrevista</option>
                              <option>Segunda entrevista</option>
                              <option>Prueba técnica</option>
                              <option>Entrevista final</option>
                              <option>Oferta enviada</option>
                              <option>Contratado</option>
                            </select>
                          </div>
                          <div className="cand-form-field">
                            <label className="field-label">RESULTADO</label>
                            <select
                              className="form-select input-field"
                              value={candForm.resultado}
                              onChange={(e) =>
                                setCandForm((f) => ({
                                  ...f,
                                  resultado: e.target.value,
                                }))
                              }
                            >
                              <option>Pendiente</option>
                              <option>Positivo</option>
                              <option>Negativo</option>
                              <option>En espera</option>
                            </select>
                          </div>
                        </div>
                        <div className="cand-form-notes-row">
                          <textarea
                            className="form-control input-field"
                            rows={2}
                            placeholder="Observaciones, feedback de la entrevista..."
                            value={candForm.notas}
                            onChange={(e) =>
                              setCandForm((f) => ({
                                ...f,
                                notas: e.target.value,
                              }))
                            }
                          />
                          <button
                            className="btn btn-primary-custom cand-add-btn"
                            onClick={handleAddCandidato}
                          >
                            <i className="bi bi-plus-lg"></i>
                            <span>Añadir</span>
                          </button>
                        </div>
                      </div>

                      {candidatosList.length > 0 ? (
                        <div className="cand-tracking-list">
                          {candidatosList.map((c, i) => (
                            <div key={i} className="cand-tracking-item">
                              <div className="cand-avatar">
                                <i className="bi bi-diagram-3"></i>
                              </div>
                              <div className="cand-body">
                                <div className="cand-body-top">
                                  <span className="cand-nombre">{c.fase}</span>
                                  <span
                                    className={`cand-resultado-badge cand-resultado-${c.resultado.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    {c.resultado === 'Pendiente' && (
                                      <i className="bi bi-clock-fill me-1"></i>
                                    )}
                                    {c.resultado === 'Positivo' && (
                                      <i className="bi bi-check-circle-fill me-1"></i>
                                    )}
                                    {c.resultado === 'Negativo' && (
                                      <i className="bi bi-x-circle-fill me-1"></i>
                                    )}
                                    {c.resultado === 'En espera' && (
                                      <i className="bi bi-pause-circle-fill me-1"></i>
                                    )}
                                    {c.resultado}
                                  </span>
                                </div>
                                <div className="cand-body-mid">
                                  <span className="cand-fecha">
                                    <i className="bi bi-calendar3 me-1"></i>
                                    {c.fecha}
                                  </span>
                                </div>
                                {c.notas && (
                                  <div className="cand-notas">
                                    <i className="bi bi-chat-left-text me-1"></i>
                                    {c.notas}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="tab-empty">
                          <i className="bi bi-diagram-3"></i>
                          <p>Aún no hay fases registradas en el proceso.</p>
                          <small className="text-muted">
                            Usa el formulario de arriba para registrar la
                            primera fase.
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'documentos' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">ADJUNTAR DOCUMENTOS</h4>

                      <div className="doc-upload-row mb-3">
                        <div>
                          <label className="field-label" htmlFor="doc-tipo">
                            TIPO DE DOCUMENTO
                          </label>
                          <select
                            id="doc-tipo"
                            className="form-select input-field doc-tipo-select"
                            value={docTipo}
                            onChange={(e) => setDocTipo(e.target.value)}
                          >
                            <option value="" disabled>
                              Selecciona tipo de documento…
                            </option>
                            <option>CV</option>
                            <option>Oferta económica</option>
                            <option>Contrato</option>
                            <option>Prueba técnica</option>
                            <option>Informe</option>
                            <option>Otro</option>
                          </select>
                        </div>
                        <label
                          className={`doc-dropzone ${draggingOver ? 'doc-dropzone--active' : ''}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDraggingOver(true);
                          }}
                          onDragLeave={() => setDraggingOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDraggingOver(false);
                            handleAdjuntarArchivos(e.dataTransfer.files);
                          }}
                        >
                          <input
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) =>
                              handleAdjuntarArchivos(e.target.files)
                            }
                          />
                          <i className="bi bi-cloud-arrow-up-fill"></i>
                          <span>
                            Arrastra archivos aquí o{' '}
                            <strong>haz clic para seleccionar</strong>
                          </span>
                          <small>PDF, Word, Excel, imágenes…</small>
                        </label>
                      </div>

                      <h4 className="section-title">
                        ARCHIVOS ADJUNTOS{' '}
                        {localDocs.length > 0 && (
                          <span className="doc-count">{localDocs.length}</span>
                        )}
                      </h4>
                      {candidate?.cvUrl && (
                        <a
                          href={ENDPOINTS.recruitment.candidatos.downloadCV(
                            candidate.cvUrl.split('/').pop()
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="doc-item"
                          style={{ textDecoration: 'none' }}
                        >
                          <div className="doc-icon">
                            <i className="bi bi-file-earmark-pdf text-danger"></i>
                          </div>
                          <div className="flex-grow-1">
                            <div className="doc-name">
                              CV del candidato (PDF)
                            </div>
                            <div className="doc-meta">
                              <span className="doc-tipo-badge">CV</span>
                            </div>
                          </div>
                          <i className="bi bi-download"></i>
                        </a>
                      )}
                      {localDocs.length > 0 ? (
                        <div className="doc-list">
                          {localDocs.map((doc, i) => (
                            <div key={i} className="doc-item">
                              <div className="doc-icon">
                                <i
                                  className={`bi ${getDocIcon(doc.nombre)}`}
                                ></i>
                              </div>
                              <div className="flex-grow-1">
                                <div className="doc-name">{doc.nombre}</div>
                                <div className="doc-meta">
                                  <span className="doc-tipo-badge">
                                    {doc.tipo}
                                  </span>
                                  {doc.tamaño && <span>· {doc.tamaño}</span>}
                                  <span>· {doc.fecha}</span>
                                </div>
                              </div>
                              <div className="d-flex gap-1">
                                <button
                                  className="btn-icon btn-icon-sm"
                                  title="Descargar"
                                >
                                  <i className="bi bi-download"></i>
                                </button>
                                <button
                                  className="btn-icon btn-icon-sm btn-icon-danger"
                                  title="Eliminar"
                                  onClick={() => handleEliminarDoc(i)}
                                >
                                  <i className="bi bi-trash3"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !candidate?.cvUrl && (
                          <div className="tab-empty">
                            <i className="bi bi-file-earmark"></i>
                            <p>No hay documentos adjuntos todavía.</p>
                          </div>
                        )
                      )}
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
