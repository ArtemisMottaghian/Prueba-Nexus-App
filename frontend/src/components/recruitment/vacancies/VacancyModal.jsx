import { useState, useEffect } from 'react';
import SourceOriginBadge from '../shared/SourceOriginBadge';
import {
  getClienteByNombre,
  updateEstadoCuenta,
} from '../../../services/clientesService';
import { vacanciesService } from '../../../services/vacanciesService';
import { useAuth } from '../../../context/AuthContext';
import CrmEmpresaPanel from '../../crm/CrmEmpresaPanel';
import './VacancyModal.css';

export default function VacancyModal({
  job,
  onClose,
  onUpdateStatus,
  onToggleFavorite,
}) {
  const { hasRole } = useAuth();
  const isReclutador = hasRole('hr_manager') || hasRole('reclutador');

  const [activeTab, setActiveTab] = useState('detalles');
  const [localStatus, setLocalStatus] = useState(job?.status || '');
  const [localIsFavorite, setLocalIsFavorite] = useState(
    job?.isFavorite || false
  );
  const [localSeguimiento, setLocalSeguimiento] = useState(
    job?.seguimiento || []
  );
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Seguimiento candidato
  const [candidatosList, setCandidatosList] = useState(job?.candidatos || []);
  const [candForm, setCandForm] = useState({
    nombre: '',
    fase: 'Enviado CV',
    resultado: 'Pendiente',
    notas: '',
  });

  // Contacto empresa — mensaje automático
  const [mensajeGenerado, setMensajeGenerado] = useState('');
  const [generandoMensaje, setGenerandoMensaje] = useState(false);
  const [mensajeCopied, setMensajeCopied] = useState(false);

  // CRM de la EMPRESA asociada a la vacante (Issue #329)
  const [empresaCrm, setEmpresaCrm] = useState(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);

  useEffect(() => {
    // Cargamos el CRM solo cuando se abre la pestaña CRM y hay empresa identificada
    let cancelado = false;
    if (activeTab !== 'crm' || !job?.companyName || empresaCrm) return;

    (async () => {
      try {
        setLoadingEmpresa(true);
        const empresa = await getClienteByNombre(job.companyName);
        if (!cancelado) setEmpresaCrm(empresa);
      } catch (err) {
        console.error('Error cargando CRM de la empresa:', err);
      } finally {
        if (!cancelado) setLoadingEmpresa(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [activeTab, job?.companyName, empresaCrm]);

  if (!job) return null;

  const handleSave = async () => {
    if (onUpdateStatus) onUpdateStatus(job.id, localStatus);
    try {
      await vacanciesService.updateVacancy(job.id, { status: localStatus });
    } catch {
      // Persiste localmente vía Vacancies.jsx (handleUpdateJobStatus ya lo guarda en LS)
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  const handleToggleFavoriteModal = () => {
    const newFav = !localIsFavorite;
    setLocalIsFavorite(newFav);
    if (onToggleFavorite) onToggleFavorite(job.id, localIsFavorite);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    const nuevaNota = {
      texto: noteText.trim(),
      fecha: new Date().toLocaleDateString('es-ES'),
    };
    setLocalSeguimiento((prev) => [nuevaNota, ...prev]);
    setNoteText('');
    try {
      await vacanciesService.addNote(job.id, nuevaNota.texto);
    } catch {
      // Nota añadida localmente, se sincronizará cuando el backend esté disponible
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateEstadoCuenta = async (nuevoEstado) => {
    if (!empresaCrm) return;
    // Optimistic update: el cambio se refleja inmediatamente
    setEmpresaCrm((prev) => ({ ...prev, estadoCuenta: nuevoEstado }));
    try {
      await updateEstadoCuenta(empresaCrm.id, nuevoEstado);
    } catch (err) {
      console.error('Error actualizando estado de cuenta:', err);
    }
  };

  const handleGenerarMensaje = (contacto) => {
    setGenerandoMensaje(true);
    setMensajeGenerado('');
    const nombre = contacto?.nombre || 'Responsable de selección';
    const empresa = job.companyName || 'su empresa';
    const puesto = job.title || 'el puesto';
    const mensaje = `Hola ${nombre},\n\nMe pongo en contacto contigo desde Nexus porque hemos identificado que ${empresa} está buscando un/a ${puesto}.\n\nContamos con candidatos/as especializados/as en este perfil que podrían encajar perfectamente en vuestra búsqueda. Estaría encantado/a de compartir algunos perfiles con vosotros sin ningún compromiso.\n\n¿Tendríais unos minutos esta semana para una breve llamada?\n\nQuedo a vuestra disposición.\n\nUn saludo,\nEquipo Nexus Talent`;
    setTimeout(() => {
      setMensajeGenerado(mensaje);
      setGenerandoMensaje(false);
    }, 600);
  };

  const handleCopiarMensaje = () => {
    navigator.clipboard.writeText(mensajeGenerado).then(() => {
      setMensajeCopied(true);
      setTimeout(() => setMensajeCopied(false), 2000);
    });
  };

  const handleAddCandidato = () => {
    if (!candForm.nombre.trim()) return;
    const nuevo = {
      ...candForm,
      nombre: candForm.nombre.trim(),
      fecha: new Date().toLocaleDateString('es-ES'),
    };
    setCandidatosList((prev) => [nuevo, ...prev]);
    setCandForm({
      nombre: '',
      fase: 'Enviado CV',
      resultado: 'Pendiente',
      notas: '',
    });
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
        <div className="modal-dialog modal-lg modal-vacancy modal-dialog-centered modal-dialog-scrollable">
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
                  title={
                    localIsFavorite ? 'Quitar de favoritos' : 'Marcar favorita'
                  }
                  onClick={handleToggleFavoriteModal}
                >
                  <i
                    className={
                      localIsFavorite
                        ? 'bi bi-star-fill text-warning'
                        : 'bi bi-star'
                    }
                  ></i>
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
                {!isReclutador && (
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === 'contacto' ? 'active' : ''}`}
                      onClick={() => setActiveTab('contacto')}
                      title="Contacto de la empresa para esta vacante"
                    >
                      <i className="bi bi-person-lines-fill me-2"></i>Contacto
                    </button>
                  </li>
                )}
                {!isReclutador && (
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === 'crm' ? 'active' : ''}`}
                      onClick={() => setActiveTab('crm')}
                      title="Seguimiento comercial vinculado a la empresa"
                    >
                      <i className="bi bi-building-check me-2"></i>
                      CRM Empresa
                    </button>
                  </li>
                )}
                {!isReclutador && (
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === 'seguimiento' ? 'active' : ''}`}
                      onClick={() => setActiveTab('seguimiento')}
                    >
                      <i className="bi bi-list-check me-2"></i>Actividad vacante
                    </button>
                  </li>
                )}
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
                              <SourceOriginBadge
                                source={job.source || 'Nexus'}
                              />
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

                {/* TAB CONTACTO — oculto para reclutador */}
                {activeTab === 'contacto' &&
                  !isReclutador &&
                  (() => {
                    // Construimos lista de contactos a partir del objeto job
                    const contactos = job.contactos?.length
                      ? job.contactos
                      : job.contactEmail || job.contactPhone || job.contactName
                        ? [
                            {
                              nombre: job.contactName || 'Responsable',
                              email: job.contactEmail,
                              telefono: job.contactPhone,
                              cargo: job.contactRole || '',
                            },
                          ]
                        : [];

                    return (
                      <div className="tab-pane fade show active">
                        <div className="detail-section">
                          <h4 className="section-title">
                            Contacto de la empresa
                          </h4>

                          {contactos.length > 0 ? (
                            <div className="contact-cards-grid">
                              {contactos.map((c, i) => (
                                <div key={i} className="contact-card">
                                  <div className="contact-avatar">
                                    {(c.nombre || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="contact-info">
                                    <div className="contact-nombre">
                                      {c.nombre || '—'}
                                    </div>
                                    {c.cargo && (
                                      <div className="contact-cargo">
                                        {c.cargo}
                                      </div>
                                    )}
                                    <div className="contact-data-row">
                                      {c.email && (
                                        <a
                                          href={`mailto:${c.email}`}
                                          className="contact-link"
                                        >
                                          <i className="bi bi-envelope-fill"></i>
                                          {c.email}
                                        </a>
                                      )}
                                      {c.telefono && (
                                        <a
                                          href={`tel:${c.telefono}`}
                                          className="contact-link"
                                        >
                                          <i className="bi bi-telephone-fill"></i>
                                          {c.telefono}
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    className="btn btn-primary-custom btn-sm contact-msg-btn"
                                    onClick={() => handleGenerarMensaje(c)}
                                    disabled={generandoMensaje}
                                    title="Generar mensaje de contacto automático"
                                  >
                                    <i className="bi bi-magic me-1"></i>
                                    Generar mensaje
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="contact-empty">
                              <i className="bi bi-person-x"></i>
                              <p>
                                No se han detectado contactos para esta empresa.
                              </p>
                              <small>
                                La IA mostrará aquí automáticamente los
                                contactos cuando estén disponibles.
                              </small>
                            </div>
                          )}
                        </div>

                        {/* Sección mensaje automático */}
                        <div className="detail-section">
                          <h4 className="section-title">
                            <i
                              className="bi bi-magic me-2"
                              style={{ color: 'var(--color-purple-secondary)' }}
                            ></i>
                            Mensaje de contacto automático
                          </h4>

                          {!mensajeGenerado && !generandoMensaje && (
                            <div className="msg-placeholder">
                              <i className="bi bi-chat-square-dots"></i>
                              <p>
                                Selecciona un contacto y pulsa{' '}
                                <strong>Generar mensaje</strong> para que la IA
                                redacte un primer contacto personalizado.
                              </p>
                              {contactos.length === 0 && (
                                <button
                                  className="btn btn-primary-custom btn-sm mt-2"
                                  onClick={() => handleGenerarMensaje(null)}
                                  disabled={generandoMensaje}
                                >
                                  <i className="bi bi-magic me-2"></i>Generar
                                  mensaje genérico
                                </button>
                              )}
                            </div>
                          )}

                          {generandoMensaje && (
                            <div className="text-center py-3 text-muted small">
                              <div
                                className="spinner-border spinner-border-sm me-2"
                                role="status"
                              ></div>
                              Generando mensaje...
                            </div>
                          )}

                          {mensajeGenerado && !generandoMensaje && (
                            <div className="msg-generated">
                              <div className="msg-generated-header">
                                <span className="msg-generated-label">
                                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                                  Mensaje listo
                                </span>
                                <button
                                  className="btn-icon btn-icon-sm"
                                  onClick={handleCopiarMensaje}
                                  title="Copiar al portapapeles"
                                >
                                  {mensajeCopied ? (
                                    <i className="bi bi-check2 text-success"></i>
                                  ) : (
                                    <i className="bi bi-clipboard"></i>
                                  )}
                                </button>
                              </div>
                              <textarea
                                className="form-control msg-textarea"
                                rows={8}
                                value={mensajeGenerado}
                                onChange={(e) =>
                                  setMensajeGenerado(e.target.value)
                                }
                              />
                              <div className="msg-generated-actions">
                                <button
                                  className="btn btn-secondary-custom btn-sm"
                                  onClick={() =>
                                    handleGenerarMensaje(contactos[0] || null)
                                  }
                                >
                                  <i className="bi bi-arrow-clockwise me-1"></i>
                                  Regenerar
                                </button>
                                <button
                                  className="btn btn-primary-custom btn-sm"
                                  onClick={handleCopiarMensaje}
                                >
                                  {mensajeCopied ? (
                                    <>
                                      <i className="bi bi-check2 me-1"></i>
                                      ¡Copiado!
                                    </>
                                  ) : (
                                    <>
                                      <i className="bi bi-clipboard me-1"></i>
                                      Copiar
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                {/* TAB CRM EMPRESA — oculto para reclutador */}
                {activeTab === 'crm' && !isReclutador && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">
                        Seguimiento comercial de la empresa
                      </h4>
                      <p className="crm-tab-hint">
                        <i className="bi bi-info-circle me-2"></i>
                        Esta información está vinculada a la{' '}
                        <strong>empresa</strong> ({job.companyName}) y es la
                        misma para todas sus vacantes.
                      </p>
                      {loadingEmpresa ? (
                        <div className="text-center py-4 text-muted small">
                          <div
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          ></div>
                          Cargando seguimiento comercial...
                        </div>
                      ) : (
                        <CrmEmpresaPanel
                          empresa={empresaCrm}
                          compact
                          onUpdateEstadoCuenta={handleUpdateEstadoCuenta}
                        />
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'seguimiento' && !isReclutador && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">
                        Actividad de esta vacante
                      </h4>

                      {/* Formulario para añadir nota */}
                      <div className="add-note-form mb-4">
                        <textarea
                          className="form-control input-field mb-2"
                          rows={2}
                          placeholder="Escribe una nota o actividad..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) handleAddNote();
                          }}
                        />
                        <button
                          className="btn btn-primary-custom btn-sm"
                          onClick={handleAddNote}
                          disabled={savingNote || !noteText.trim()}
                        >
                          {savingNote ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-2"
                                role="status"
                              />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-plus-circle me-2"></i>Agregar
                              nota
                            </>
                          )}
                        </button>
                      </div>

                      {localSeguimiento.length > 0 ? (
                        <div className="seguimiento-timeline">
                          {localSeguimiento.map((item, i) => (
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
                          <small className="text-muted">
                            ¿Buscas el seguimiento comercial? Ahora vive en la
                            pestaña <strong>CRM Empresa</strong>.
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'candidatos' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">
                        Seguimiento de candidatos
                      </h4>

                      {/* Formulario añadir candidato */}
                      <div className="cand-tracking-form mb-4">
                        <div className="cand-form-row">
                          <div className="cand-form-field cand-form-field--wide">
                            <label className="field-label">
                              Nombre del candidato
                            </label>
                            <input
                              type="text"
                              className="form-control input-field"
                              placeholder="Ej: Ana García"
                              value={candForm.nombre}
                              onChange={(e) =>
                                setCandForm((f) => ({
                                  ...f,
                                  nombre: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddCandidato();
                              }}
                            />
                          </div>
                          <div className="cand-form-field">
                            <label className="field-label">
                              Tipo de entrevista / Fase
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
                            <label className="field-label">Resultado</label>
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
                            disabled={!candForm.nombre.trim()}
                          >
                            <i className="bi bi-person-plus-fill"></i>
                            <span>Añadir</span>
                          </button>
                        </div>
                      </div>

                      {/* Lista de candidatos */}
                      {candidatosList.length > 0 ? (
                        <div className="cand-tracking-list">
                          {candidatosList.map((c, i) => (
                            <div key={i} className="cand-tracking-item">
                              {/* Avatar inicial */}
                              <div className="cand-avatar">
                                {c.nombre.charAt(0).toUpperCase()}
                              </div>
                              {/* Cuerpo */}
                              <div className="cand-body">
                                <div className="cand-body-top">
                                  <span className="cand-nombre">
                                    {c.nombre}
                                  </span>
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
                                  <span className="cand-fase-badge">
                                    <i className="bi bi-diagram-3 me-1"></i>
                                    {c.fase}
                                  </span>
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
                          <i className="bi bi-people"></i>
                          <p>
                            No hay candidatos registrados para esta vacante.
                          </p>
                          <small className="text-muted">
                            Usa el formulario de arriba para añadir el primer
                            candidato.
                          </small>
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
                disabled={saveSuccess}
              >
                {saveSuccess ? (
                  <>
                    <i className="bi bi-check2-all me-2"></i>¡Guardado!
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>Guardar cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
