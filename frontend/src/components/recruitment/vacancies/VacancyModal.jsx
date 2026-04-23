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

/**
 * Helper para estructurar la descripción en secciones y bullets
 */
function parseDescripcion(texto) {
  if (!texto) return [];

  const TITULOS_REGEX =
    /(Requisitos mínimos|Requisitos|Se valorará|Funciones|Se ofrece|Condiciones|Horario|Perfil)\s*:/gi;
  const normalizado = texto.replace(TITULOS_REGEX, '\n§§$1:\n');
  const trozos = normalizado
    .split('\n§§')
    .map((t) => t.trim())
    .filter(Boolean);

  return trozos.map((trozo) => {
    const matchTitulo = trozo.match(/^([^:\n]{3,40}):\s*/);
    const titulo = matchTitulo ? matchTitulo[1].trim() : null;
    const cuerpo = matchTitulo ? trozo.slice(matchTitulo[0].length) : trozo;

    const partes = cuerpo
      .split('·')
      .map((p) => p.trim())
      .filter(Boolean);

    if (partes.length > 1) {
      return {
        titulo,
        intro:
          partes[0].endsWith(':') || partes[0].endsWith('.') ? partes[0] : null,
        bullets:
          partes[0].endsWith(':') || partes[0].endsWith('.')
            ? partes.slice(1)
            : partes,
      };
    }
    return { titulo, intro: cuerpo, bullets: [] };
  });
}

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

  // Estados para Candidatos y Documentos
  const [candidatosList, setCandidatosList] = useState(job?.candidatos || []);
  const [candForm, setCandForm] = useState({
    nombre: '',
    fase: 'Enviado CV',
    resultado: 'Pendiente',
    notas: '',
  });
  const [localDocs, setLocalDocs] = useState(job?.documentos || []);
  const [docTipo, setDocTipo] = useState('CV');
  const [draggingOver, setDraggingOver] = useState(false);

  // Estados para CRM y Mensajería
  const [mensajeGenerado, setMensajeGenerado] = useState('');
  const [generandoMensaje, setGenerandoMensaje] = useState(false);
  const [mensajeCopied, setMensajeCopied] = useState(false);
  const [empresaCrm, setEmpresaCrm] = useState(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);

  useEffect(() => {
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
    } catch (err) {
      console.error('Error al actualizar vacante:', err);
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
      /* Persistencia local */
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateEstadoCuenta = async (nuevoEstado) => {
    if (!empresaCrm) return;
    setEmpresaCrm((prev) => ({ ...prev, estadoCuenta: nuevoEstado }));
    try {
      await updateEstadoCuenta(empresaCrm.id, nuevoEstado);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjuntarArchivos = (files) => {
    if (!files?.length) return;
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
    const s = status?.toLowerCase();
    if (s === 'new' || s === 'nueva') return 'badge-nueva';
    if (s === 'contacted' || s === 'contactada') return 'badge-contactada';
    if (s === 'in progress' || s === 'en proceso') return 'badge-en-proceso';
    if (s === 'rejected' || s === 'descartada') return 'badge-descartada';
    return 'badge-nueva';
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
                    <span className="badge-client-sm">Cliente Nexus</span>
                  )}
                  <span className={`badge ${getBadgeClass(localStatus)} ms-1`}>
                    {localStatus}
                  </span>
                </div>
              </div>
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
                  <option value="New">Nueva (New)</option>
                  <option value="Contacted">Contactada</option>
                  <option value="In progress">En proceso</option>
                  <option value="Rejected">Descartada</option>
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
                  <>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeTab === 'contacto' ? 'active' : ''}`}
                        onClick={() => setActiveTab('contacto')}
                      >
                        <i className="bi bi-person-lines-fill me-2"></i>Contacto
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeTab === 'crm' ? 'active' : ''}`}
                        onClick={() => setActiveTab('crm')}
                      >
                        <i className="bi bi-building-check me-2"></i>CRM Empresa
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeTab === 'seguimiento' ? 'active' : ''}`}
                        onClick={() => setActiveTab('seguimiento')}
                      >
                        <i className="bi bi-list-check me-2"></i>Actividad
                        vacante
                      </button>
                    </li>
                  </>
                )}
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'candidatos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('candidatos')}
                  >
                    <i className="bi bi-people-fill me-2"></i>Seguimiento
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'documentos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('documentos')}
                  >
                    <i className="bi bi-file-earmark me-2"></i>Docs
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
                          <div className="detail-icon icon-orange">
                            <i className="bi bi-briefcase"></i>
                          </div>
                          <div>
                            <div className="field-label">
                              Sector / Industria
                            </div>
                            <div className="field-value">
                              {job.industry || job.sector || 'No especificado'}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-purple">
                            <i className="bi bi-layers"></i>
                          </div>
                          <div>
                            <div className="field-label">
                              Vacantes Activas Empresa
                            </div>
                            <div className="field-value">
                              {job.activeVacancies !== undefined
                                ? job.activeVacancies
                                : '—'}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-blue">
                            <i className="bi bi-geo-alt"></i>
                          </div>
                          <div>
                            <div className="field-label">Ubicación</div>
                            <div className="field-value">
                              {job.location || 'No especificada'}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-green">
                            <i className="bi bi-cash-stack"></i>
                          </div>
                          <div>
                            <div className="field-label">Rango Salarial</div>
                            <div className="field-value">
                              {job.salary || 'A convenir'}
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-cyan">
                            <i className="bi bi-globe"></i>
                          </div>
                          <div>
                            <div className="field-label">Fuente de origen</div>
                            <div className="field-value">
                              <SourceOriginBadge source={job.source} />
                            </div>
                          </div>
                        </div>
                        <div className="detail-field">
                          <div className="detail-icon icon-gray">
                            <i className="bi bi-clock"></i>
                          </div>
                          <div>
                            <div className="field-label">Publicado hace</div>
                            <div className="field-value">{job.time || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4 className="section-title">Descripción del puesto</h4>
                      <div className="vacancy-description">
                        {job.description ? (
                          parseDescripcion(job.description).map(
                            (seccion, idx) => (
                              <div
                                key={idx}
                                className="vacancy-description-block"
                              >
                                {seccion.titulo && (
                                  <h5 className="vacancy-description-subtitle">
                                    {seccion.titulo}
                                  </h5>
                                )}
                                {seccion.intro && <p>{seccion.intro}</p>}
                                {seccion.bullets.length > 0 && (
                                  <ul className="vacancy-description-list">
                                    {seccion.bullets.map((b, i) => (
                                      <li key={i}>{b}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )
                          )
                        ) : (
                          <p>No hay descripción disponible.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'contacto' && !isReclutador && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">Contacto de la empresa</h4>
                      {(() => {
                        const contactos = job.contactos?.length
                          ? job.contactos
                          : job.contactEmail ||
                              job.contactPhone ||
                              job.contactName
                            ? [
                                {
                                  nombre: job.contactName || 'Responsable',
                                  email: job.contactEmail,
                                  telefono: job.contactPhone,
                                  cargo: job.contactRole || '',
                                },
                              ]
                            : [];

                        return contactos.length > 0 ? (
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
                                        <i className="bi bi-envelope-fill"></i>{' '}
                                        {c.email}
                                      </a>
                                    )}
                                    {c.telefono && (
                                      <a
                                        href={`tel:${c.telefono}`}
                                        className="contact-link"
                                      >
                                        <i className="bi bi-telephone-fill"></i>{' '}
                                        {c.telefono}
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <button
                                  className="btn btn-primary-custom btn-sm contact-msg-btn"
                                  onClick={() => handleGenerarMensaje(c)}
                                  disabled={generandoMensaje}
                                >
                                  <i className="bi bi-magic me-1"></i> Generar
                                  mensaje
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
                          </div>
                        );
                      })()}
                    </div>
                    {mensajeGenerado && (
                      <div className="detail-section">
                        <h4 className="section-title">
                          <i className="bi bi-magic me-2"></i> Mensaje generado
                        </h4>
                        <textarea
                          className="form-control msg-textarea"
                          rows={8}
                          value={mensajeGenerado}
                          onChange={(e) => setMensajeGenerado(e.target.value)}
                        />
                        <div className="msg-generated-actions mt-2">
                          <button
                            className="btn btn-primary-custom btn-sm"
                            onClick={handleCopiarMensaje}
                          >
                            {mensajeCopied ? '¡Copiado!' : 'Copiar mensaje'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'crm' && !isReclutador && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">
                        Seguimiento comercial de la empresa
                      </h4>
                      {loadingEmpresa ? (
                        <p>Cargando datos comerciales...</p>
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
                      <div className="add-note-form mb-4">
                        <textarea
                          className="form-control input-field mb-2"
                          rows={2}
                          placeholder="Escribe una nota..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                        />
                        <button
                          className="btn btn-primary-custom btn-sm"
                          onClick={handleAddNote}
                          disabled={savingNote || !noteText.trim()}
                        >
                          Agregar nota
                        </button>
                      </div>
                      <div className="seguimiento-timeline">
                        {localSeguimiento.map((item, i) => (
                          <div key={i} className="seguimiento-item">
                            <div className="seguimiento-card">
                              <p>{item.texto}</p>
                              <span>{item.fecha}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'candidatos' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">
                        Seguimiento de candidatos
                      </h4>
                      <div className="cand-tracking-form mb-4">
                        <div className="cand-form-row gap-2 d-flex">
                          <input
                            className="form-control"
                            placeholder="Nombre"
                            value={candForm.nombre}
                            onChange={(e) =>
                              setCandForm({
                                ...candForm,
                                nombre: e.target.value,
                              })
                            }
                          />
                          <button
                            className="btn btn-primary-custom"
                            onClick={handleAddCandidato}
                          >
                            Añadir
                          </button>
                        </div>
                      </div>
                      <div className="cand-tracking-list">
                        {candidatosList.length > 0 ? (
                          candidatosList.map((c, i) => (
                            <div
                              key={i}
                              className="cand-tracking-item p-2 border-bottom d-flex justify-content-between align-items-center"
                            >
                              <span>
                                <strong>{c.nombre}</strong> - {c.fase}
                              </span>
                              <span
                                className={`badge cand-resultado-${c.resultado.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                {c.resultado}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-center p-3 text-muted">
                            Sin candidatos asignados.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'documentos' && (
                  <div className="tab-pane fade show active">
                    <div className="detail-section">
                      <h4 className="section-title">Documentos</h4>
                      <div
                        className={`doc-dropzone p-4 border-dashed text-center ${draggingOver ? 'bg-light' : ''}`}
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
                        <p>Arrastra archivos aquí o haz clic para subir</p>
                        <input
                          type="file"
                          multiple
                          className="d-none"
                          id="fileIn"
                          onChange={(e) =>
                            handleAdjuntarArchivos(e.target.files)
                          }
                        />
                        <label
                          htmlFor="fileIn"
                          className="btn btn-outline-primary btn-sm"
                        >
                          Seleccionar archivos
                        </label>
                      </div>
                      <div className="doc-list mt-3">
                        {localDocs.map((doc, i) => (
                          <div
                            key={i}
                            className="doc-item d-flex justify-content-between p-2"
                          >
                            <span>
                              <i className={`bi ${getDocIcon(doc.nombre)}`}></i>{' '}
                              {doc.nombre}
                            </span>
                            <button
                              className="btn btn-link text-danger"
                              onClick={() => handleEliminarDoc(i)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

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
                {saveSuccess ? '¡Guardado!' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
