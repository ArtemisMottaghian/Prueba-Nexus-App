import { useState, useEffect } from 'react';
import SourceOriginBadge from '../shared/SourceOriginBadge';
import {
  getClienteById,
  updateEstadoCuenta,
} from '../../../services/clientesService';
import { vacanciesService } from '../../../services/vacanciesService';
import { usersService } from '../../../services/userManagementService';
import { useAuth } from '../../../context/AuthContext';
import CrmEmpresaPanel from '../../crm/CrmEmpresaPanel';
import SmartMatchResults from './SmartMatchResults';
import { ENDPOINTS, authFetch } from '../../../services/api';
import './VacancyModal.css';

/**
 * Estructura la descripción plana de la vacante en secciones con bullets.
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
  onAsignarVacante,
  currentUser,
  isNegocio,
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

  const [editingNoteIdx, setEditingNoteIdx] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const [candidatosList, setCandidatosList] = useState(job?.candidatos || []);
  const [expandedCandId, setExpandedCandId] = useState(null);
  const [editForm, setEditForm] = useState({
    fase: '',
    resultado: '',
    nota: '',
  });
  const [candForm, setCandForm] = useState({
    nombre: '',
    fase: 'Enviado CV',
    resultado: 'Pendiente',
    notas: '',
  });

  const [localAsignados, setLocalAsignados] = useState(() => {
    const a = job?.assignedTo;
    if (!a) return [];
    return Array.isArray(a) ? a : [a];
  });
  const [hrUsers, setHrUsers] = useState([]);
  const [selectedHrId, setSelectedHrId] = useState('');

  // --- 🤖 ESTADOS Y FUNCIÓN PARA SMART MATCH IA (VERSIÓN ANDER/GEMINI) 🤖 ---
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [isMatchingLocal, setIsMatchingLocal] = useState(false);
  const [matchResults, setMatchResults] = useState([]);

  const handleSmartMatchClick = async (e) => {
    e.stopPropagation();
    setIsMatchingLocal(true);

    try {
      // 1. LLAMADA AL ENDPOINT POST DE ANDER
      const res = await authFetch(ENDPOINTS.ai.matchVacancy(job.id), {
        method: 'POST',
      });

      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

      const data = await res.json();

      // 2. ANDER DEVUELVE 'top_candidates' (no 'ranked')
      const topCandidates = data.top_candidates || [];

      // 3. MAPEO ADAPTADO A LOS CAMPOS DE ANDER
      const normalized = topCandidates.map((item) => ({
        id: item.candidate_id,
        nombre: item.name || 'Candidato desconocido',
        score: item.affinity_percentage || 0,
        reasoning: item.reason || 'Sin descripción disponible.',
        location: 'No especificada', // Fallback
      }));

      setMatchResults(normalized);
      setShowMatchModal(true);
    } catch (error) {
      console.error('Error en Smart Match IA:', error);
      setMatchResults([]);
      setShowMatchModal(true);
    } finally {
      setIsMatchingLocal(false);
    }
  };

  const handleEliminarCandidato = async (candidatoId) => {
    try {
      const res = await authFetch(
        ENDPOINTS.recruitment.vacantes.deleteApplication(job.id, candidatoId),
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      setCandidatosList((prev) => prev.filter((c) => c.id !== candidatoId));
    } catch (err) {
      console.error('Error eliminando candidato:', err);
    }
  };

  const handleGuardarEdicion = async (c) => {
    try {
      const res = await authFetch(
        `${ENDPOINTS.recruitment.vacantes.applications(job.id)}/${c.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phase: editForm.fase,
            result: editForm.resultado,
            note: editForm.nota,
          }),
        }
      );
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      setCandidatosList((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? {
                ...x,
                fase: editForm.fase,
                resultado: editForm.resultado,
                notas: editForm.nota,
              }
            : x
        )
      );
      setExpandedCandId(null);
    } catch (err) {
      console.error('Error guardando edición:', err);
    }
  };

  // --------------------------------------------------------------------------

  useEffect(() => {
    if (isNegocio && activeTab === 'detalles') {
      const fetchHrUsers = async () => {
        try {
          const users = await usersService.getAllUsers();
          const hr = users.filter(
            (u) => u.role === 'hr_manager' || u.role === 'reclutador'
          );
          setHrUsers(hr);
        } catch (err) {
          console.error('Error fetching HR users:', err);
        }
      };
      fetchHrUsers();
    }
  }, [isNegocio, activeTab]);

  useEffect(() => {
    if (activeTab !== 'seguimiento' || !job?.id) return;

    const fetchNotes = async () => {
      try {
        const notes = await vacanciesService.getNotes(job.id);
        setLocalSeguimiento(
          notes.map((n) => ({
            id: n.id,
            texto: n.notes?.[0] || n.result || '',
            fecha: n.date ? new Date(n.date).toLocaleDateString('es-ES') : '',
            autor: n.name || 'Sistema',
          }))
        );
      } catch (err) {
        console.error('Error cargando notas:', err);
      }
    };

    fetchNotes();
  }, [activeTab, job?.id]);

  useEffect(() => {
    if (activeTab !== 'candidatos' || !job?.id) return;

    const fetchCandidatos = async () => {
      try {
        const res = await authFetch(
          ENDPOINTS.recruitment.vacantes.candidateTracking(job.id)
        );
        if (!res.ok) return;
        const data = await res.json();
        setCandidatosList(
          data.map((c) => ({
            id: c.id,
            nombre: c.name,
            fase: c.phase,
            resultado: c.result || 'Pendiente',
            notas: c.notes?.[0] || '',
            historial: c.notes || [],
            fecha: c.date ? new Date(c.date).toLocaleDateString('es-ES') : '',
          }))
        );
      } catch (err) {
        console.error('Error cargando candidatos:', err);
      }
    };

    fetchCandidatos();
  }, [activeTab, job?.id]);
  const [localDocs, setLocalDocs] = useState(job?.documentos || []);
  const [docTipo, setDocTipo] = useState('CV');
  const [draggingOver, setDraggingOver] = useState(false);

  const [contactosManuales, setContactosManuales] = useState([]);
  const [showFormContacto, setShowFormContacto] = useState(false);
  const [formContacto, setFormContacto] = useState({
    nombre: '',
    cargo: '',
    email: '',
    telefono: '',
  });
  const [mensajeGenerado, setMensajeGenerado] = useState('');
  const [generandoMensaje, setGenerandoMensaje] = useState(false);
  const [mensajeCopied, setMensajeCopied] = useState(false);
  const nombreFirma =
    currentUser?.name || currentUser?.username || 'Equipo Nexus Talent';
  const emailFirma = currentUser?.email || '';
  const firmaAuto = `Un saludo,\n${nombreFirma}${emailFirma ? `\n${emailFirma}` : ''}\nNexus Talent Solutions`;

  const [empresaCrm, setEmpresaCrm] = useState(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);

  useEffect(() => {
    let cancelado = false;

    if (activeTab !== 'crm' || !job?.company_id || empresaCrm) return;

    (async () => {
      try {
        setLoadingEmpresa(true);
        const empresa = await getClienteById(job.company_id);
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
  }, [activeTab, job?.company_id, empresaCrm]);

  if (!job) return null;

  const handleSave = async () => {
    if (onUpdateStatus) onUpdateStatus(job.id, localStatus);
    try {
      await vacanciesService.updateVacancy(job.id, { status: localStatus });
    } catch {
      // Fallback local
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

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const nuevaNota = {
      localId,
      texto: noteText.trim(),
      fecha: new Date().toLocaleDateString('es-ES'),
    };

    setLocalSeguimiento((prev) => [nuevaNota, ...prev]);
    setNoteText('');

    try {
      const notaCreada = await vacanciesService.addNote(
        job.id,
        nuevaNota.texto
      );
      if (notaCreada?.note_id) {
        setLocalSeguimiento((prev) =>
          prev.map((n) =>
            n.localId === localId ? { ...n, id: notaCreada.note_id } : n
          )
        );
      }
    } catch {
      // Fallback
    } finally {
      setSavingNote(false);
    }
  };

  const handleStartEditNote = (idx) => {
    setEditingNoteIdx(idx);
    setEditingNoteText(localSeguimiento[idx]?.texto || '');
  };

  const handleCancelEditNote = () => {
    setEditingNoteIdx(null);
    setEditingNoteText('');
  };

  const handleSaveEditNote = async (idx) => {
    const nuevoTexto = editingNoteText.trim();
    if (!nuevoTexto) return;

    const nota = localSeguimiento[idx];

    setLocalSeguimiento((prev) =>
      prev.map((n, i) =>
        i === idx
          ? {
              ...n,
              texto: nuevoTexto,
              editada: true,
              fecha: new Date().toLocaleDateString('es-ES'),
            }
          : n
      )
    );
    setEditingNoteIdx(null);
    setEditingNoteText('');

    if (nota?.id) {
      try {
        await vacanciesService.updateNote?.(job.id, nota.id, nuevoTexto);
      } catch {
        // Fallback
      }
    }
  };

  const handleDeleteNote = async (idx) => {
    const nota = localSeguimiento[idx];

    setLocalSeguimiento((prev) => prev.filter((_, i) => i !== idx));

    if (nota?.id) {
      try {
        await vacanciesService.deleteNote?.(job.id, nota.id);
      } catch {
        // Fallback
      }
    }
  };

  const handleUpdateEstadoCuenta = async (nuevoEstado) => {
    if (!empresaCrm) return;
    setEmpresaCrm((prev) => ({ ...prev, estadoCuenta: nuevoEstado }));
    try {
      await updateEstadoCuenta(empresaCrm.id, nuevoEstado);
    } catch (err) {
      console.error('Error actualizando estado de cuenta:', err);
    }
  };

  const handleAsignarReclutador = async () => {
    if (!selectedHrId) return;
    const userToAssign = hrUsers.find(
      (u) => String(u.id) === String(selectedHrId)
    );
    if (!userToAssign) return;

    const yaExiste = localAsignados.some(
      (r) => String(r.id) === String(selectedHrId)
    );
    if (yaExiste) return;

    try {
      await vacanciesService.assignHr(userToAssign.id, [job.id]);

      const nuevo = {
        id: userToAssign.id,
        nombre: userToAssign.name,
        email: userToAssign.email,
        role: userToAssign.role,
        fecha: new Date().toLocaleDateString('es-ES'),
      };
      const nuevaLista = [...localAsignados, nuevo];
      setLocalAsignados(nuevaLista);
      if (onAsignarVacante) onAsignarVacante(job.id, nuevaLista);
      setSelectedHrId('');
    } catch (err) {
      console.error('Error al asignar reclutador:', err);
      alert('Hubo un error al asignar el reclutador.');
    }
  };

  const handleDesasignarReclutador = async (idx) => {
    const r = localAsignados[idx];
    if (r.id) {
      try {
        await vacanciesService.unassignHr(r.id, [job.id]);
      } catch (err) {
        console.error('Error desasignando reclutador', err);
        alert('Hubo un error al desasignar el reclutador.');
        return;
      }
    }
    const nuevaLista = localAsignados.filter((_, i) => i !== idx);
    setLocalAsignados(nuevaLista);
    if (onAsignarVacante)
      onAsignarVacante(job.id, nuevaLista.length ? nuevaLista : null);
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

  const handleAnadirContactoManual = () => {
    if (!formContacto.nombre.trim() && !formContacto.email.trim()) return;
    setContactosManuales((prev) => [
      ...prev,
      { ...formContacto, manual: true },
    ]);
    setFormContacto({ nombre: '', cargo: '', email: '', telefono: '' });
    setShowFormContacto(false);
  };

  const handleEliminarContactoManual = (idx) => {
    setContactosManuales((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerarMensaje = (contacto) => {
    setGenerandoMensaje(true);
    setMensajeGenerado('');
    const nombre = contacto?.nombre || 'Responsable de selección';
    const empresa = job.companyName || 'su empresa';
    const puesto = job.title || 'el puesto';
    const cuerpo = `Hola ${nombre},\n\nMe pongo en contacto contigo porque hemos identificado que ${empresa} está buscando un/a ${puesto}.\n\nContamos con candidatos/as especializados/as en este perfil que podrían encajar perfectamente en vuestra búsqueda. Estaría encantado/a de compartir algunos perfiles sin ningún compromiso.\n\n¿Tendríais unos minutos esta semana para una breve llamada?\n\nQuedo a vuestra disposición.`;
    setTimeout(() => {
      setMensajeGenerado(`${cuerpo}\n\n${firmaAuto}`);
      setGenerandoMensaje(false);
    }, 600);
  };

  const handleCopiarMensaje = () => {
    navigator.clipboard.writeText(mensajeGenerado).then(() => {
      setMensajeCopied(true);
      setTimeout(() => setMensajeCopied(false), 2000);
    });
  };

  const handleAddCandidato = async () => {
    if (!candForm.nombre.trim()) return;
    try {
      await authFetch(
        ENDPOINTS.recruitment.vacantes.candidateTracking(job.id),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: candForm.nombre.trim(),
            phase: candForm.fase,
            result: candForm.resultado,
            notes: candForm.notas ? [candForm.notas] : [],
          }),
        }
      );
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
    } catch (err) {
      console.error('Error guardando seguimiento:', err);
    }
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
                <button
                  className="btn-icon"
                  title="Abrir URL pública de la vacante"
                  onClick={() => {
                    const url = `${window.location.origin}/vacante/${job.id}`;
                    window.open(url, '_blank');
                  }}
                >
                  <i className="bi bi-box-arrow-up-right"></i>
                </button>
              </div>

              {/* Tabs */}
              <div className="d-flex justify-content-between align-items-center border-bottom mb-4">
                <ul className="nav nav-tabs border-bottom-0 mb-0">
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
                        <i className="bi bi-list-check me-2"></i>Actividad
                        vacante
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

                {isNegocio && (
                  <div className="pb-2 pe-2">
                    <button
                      className={`btn btn-primary-custom btn-sm ${isMatchingLocal ? 'disabled' : ''}`}
                      onClick={handleSmartMatchClick}
                      disabled={isMatchingLocal}
                      title="Smart Match con IA"
                    >
                      {isMatchingLocal ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Buscando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-stars me-2"></i>Smart Match IA
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

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
                          <p>
                            Sin descripción detallada disponible actualmente.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* ASIGNACIÓN — solo visible para negocio/admin */}
                    {isNegocio && (
                      <div className="detail-section">
                        <h4 className="section-title">
                          Reclutadores asignados
                          {localAsignados.filter(
                            (r) =>
                              r.role === 'hr_manager' ||
                              r.role === 'reclutador' ||
                              (r.role !== 'negocio' && r.role !== 'company')
                          ).length > 0 && (
                            <span className="doc-count">
                              {
                                localAsignados.filter(
                                  (r) =>
                                    r.role === 'hr_manager' ||
                                    r.role === 'reclutador' ||
                                    (r.role !== 'negocio' &&
                                      r.role !== 'company')
                                ).length
                              }
                            </span>
                          )}
                        </h4>

                        {localAsignados.length > 0 && (
                          <div className="asign-list mb-3">
                            {localAsignados.map((r, idx) => {
                              if (
                                r.role === 'negocio' ||
                                r.role === 'company' ||
                                (r.nombre && r.nombre.includes('_Negocio'))
                              )
                                return null;
                              return (
                                <div key={idx} className="asign-current">
                                  <div className="asign-avatar">
                                    {(r.nombre || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="asign-info">
                                    <span className="asign-nombre">
                                      {r.nombre}
                                    </span>
                                    {r.email && (
                                      <span className="asign-email">
                                        {r.email}
                                      </span>
                                    )}
                                    <span className="asign-fecha">
                                      <i className="bi bi-calendar3 me-1"></i>
                                      Asignado el {r.fecha}
                                    </span>
                                  </div>
                                  <button
                                    className="btn-icon btn-icon-sm btn-icon-danger ms-auto"
                                    title="Quitar reclutador"
                                    onClick={() =>
                                      handleDesasignarReclutador(idx)
                                    }
                                  >
                                    <i className="bi bi-person-dash"></i>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="asign-recruiter-row">
                          <select
                            className="form-select input-field"
                            value={selectedHrId}
                            onChange={(e) => setSelectedHrId(e.target.value)}
                          >
                            <option value="">
                              Selecciona un reclutador...
                            </option>
                            {hrUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary-custom btn-sm ms-2"
                            onClick={handleAsignarReclutador}
                            disabled={!selectedHrId}
                          >
                            <i className="bi bi-person-plus-fill me-1"></i>
                            Asignar
                          </button>
                        </div>
                      </div>
                    )}

                    {isReclutador && localAsignados.length > 0 && (
                      <div className="detail-section">
                        <h4 className="section-title">
                          Vacante asignada por negocio
                        </h4>
                        <div className="asign-readonly">
                          <i className="bi bi-building me-2"></i>
                          Asignada el {localAsignados[0].fecha} por el equipo de
                          negocio
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTACTO — oculto para reclutador */}
                {activeTab === 'contacto' &&
                  !isReclutador &&
                  (() => {
                    const contactosAPI = job.contactos?.length
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
                    const todosContactos = [
                      ...contactosAPI,
                      ...contactosManuales,
                    ];

                    return (
                      <div className="tab-pane fade show active">
                        <div className="detail-section">
                          <div className="contact-section-header">
                            <h4 className="section-title mb-0">
                              Contacto de la empresa
                            </h4>
                            <button
                              className="btn btn-secondary-custom btn-sm"
                              onClick={() =>
                                setShowFormContacto(!showFormContacto)
                              }
                            >
                              <i
                                className={`bi ${showFormContacto ? 'bi-x' : 'bi-person-plus-fill'} me-1`}
                              ></i>
                              {showFormContacto
                                ? 'Cancelar'
                                : 'Añadir contacto'}
                            </button>
                          </div>

                          {showFormContacto && (
                            <div className="contact-manual-form">
                              <div
                                className="cand-form-row"
                                style={{ gridTemplateColumns: '1fr 1fr' }}
                              >
                                <div className="cand-form-field">
                                  <label className="field-label">Nombre</label>
                                  <input
                                    type="text"
                                    className="form-control input-field"
                                    placeholder="Ej: Ana Martínez"
                                    value={formContacto.nombre}
                                    onChange={(e) =>
                                      setFormContacto((f) => ({
                                        ...f,
                                        nombre: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="cand-form-field">
                                  <label className="field-label">Cargo</label>
                                  <input
                                    type="text"
                                    className="form-control input-field"
                                    placeholder="Ej: HR Manager"
                                    value={formContacto.cargo}
                                    onChange={(e) =>
                                      setFormContacto((f) => ({
                                        ...f,
                                        cargo: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="cand-form-field">
                                  <label className="field-label">Email</label>
                                  <input
                                    type="email"
                                    className="form-control input-field"
                                    placeholder="contacto@empresa.com"
                                    value={formContacto.email}
                                    onChange={(e) =>
                                      setFormContacto((f) => ({
                                        ...f,
                                        email: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="cand-form-field">
                                  <label className="field-label">
                                    Teléfono
                                  </label>
                                  <input
                                    type="tel"
                                    className="form-control input-field"
                                    placeholder="+34 600 000 000"
                                    value={formContacto.telefono}
                                    onChange={(e) =>
                                      setFormContacto((f) => ({
                                        ...f,
                                        telefono: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                              <button
                                className="btn btn-primary-custom btn-sm mt-2"
                                onClick={handleAnadirContactoManual}
                                disabled={
                                  !formContacto.nombre.trim() &&
                                  !formContacto.email.trim()
                                }
                              >
                                <i className="bi bi-check2 me-1"></i>Guardar
                                contacto
                              </button>
                            </div>
                          )}

                          {todosContactos.length > 0 ? (
                            <div className="contact-cards-grid mt-3">
                              {todosContactos.map((c, i) => (
                                <div
                                  key={i}
                                  className={`contact-card ${c.manual ? 'contact-card--manual' : ''}`}
                                >
                                  <div className="contact-avatar">
                                    {(c.nombre || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="contact-info">
                                    <div className="contact-nombre">
                                      {c.nombre || '—'}
                                      {c.manual && (
                                        <span className="contact-manual-badge">
                                          Manual
                                        </span>
                                      )}
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
                                  <div className="d-flex flex-column gap-1">
                                    <button
                                      className="btn btn-primary-custom btn-sm contact-msg-btn"
                                      onClick={() => handleGenerarMensaje(c)}
                                      disabled={generandoMensaje}
                                    >
                                      <i className="bi bi-magic me-1"></i>
                                      Mensaje
                                    </button>
                                    {c.manual && (
                                      <button
                                        className="btn-icon btn-icon-sm btn-icon-danger"
                                        onClick={() =>
                                          handleEliminarContactoManual(
                                            i - contactosAPI.length
                                          )
                                        }
                                        title="Eliminar contacto"
                                      >
                                        <i className="bi bi-trash3"></i>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="contact-empty mt-3">
                              <i className="bi bi-person-x"></i>
                              <p>
                                La IA no ha detectado contactos para esta
                                empresa.
                              </p>
                              <small>
                                Usa el botón{' '}
                                <strong>&quot;Añadir contacto&quot;</strong>{' '}
                                para introducirlos manualmente.
                              </small>
                            </div>
                          )}
                        </div>

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
                                <strong>Mensaje</strong> para que se redacte un
                                primer contacto personalizado con tu firma.
                              </p>
                              {todosContactos.length === 0 && (
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
                                rows={10}
                                value={mensajeGenerado}
                                onChange={(e) =>
                                  setMensajeGenerado(e.target.value)
                                }
                              />
                              <div className="msg-generated-actions">
                                <button
                                  className="btn btn-secondary-custom btn-sm"
                                  onClick={() =>
                                    handleGenerarMensaje(
                                      todosContactos[0] || null
                                    )
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
                            <div
                              key={item.id || item.localId || i}
                              className="seguimiento-item"
                            >
                              <div className="seguimiento-dot"></div>
                              <div className="seguimiento-card">
                                {editingNoteIdx === i ? (
                                  <>
                                    <textarea
                                      className="form-control input-field mb-2"
                                      rows={2}
                                      value={editingNoteText}
                                      onChange={(e) =>
                                        setEditingNoteText(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey)
                                          handleSaveEditNote(i);
                                        if (e.key === 'Escape')
                                          handleCancelEditNote();
                                      }}
                                      autoFocus
                                    />
                                    <div className="d-flex gap-2 justify-content-end">
                                      <button
                                        className="btn btn-sm btn-secondary-custom"
                                        onClick={handleCancelEditNote}
                                      >
                                        <i className="bi bi-x-lg me-1"></i>
                                        Cancelar
                                      </button>
                                      <button
                                        className="btn btn-sm btn-primary-custom"
                                        onClick={() => handleSaveEditNote(i)}
                                        disabled={!editingNoteText.trim()}
                                      >
                                        <i className="bi bi-check2 me-1"></i>
                                        Guardar
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="seguimiento-card-header">
                                      <span className="activity-time">
                                        <i className="bi bi-clock me-1"></i>
                                        {item.fecha}
                                        {item.editada && (
                                          <span className="ms-2 text-muted small">
                                            (editada)
                                          </span>
                                        )}
                                      </span>
                                      <div className="d-flex gap-1">
                                        <button
                                          className="btn-icon btn-icon-sm"
                                          title="Editar nota"
                                          onClick={() => handleStartEditNote(i)}
                                        >
                                          <i className="bi bi-pencil"></i>
                                        </button>
                                        <button
                                          className="btn-icon btn-icon-sm btn-icon-danger"
                                          title="Eliminar nota"
                                          onClick={() => handleDeleteNote(i)}
                                        >
                                          <i className="bi bi-trash3"></i>
                                        </button>
                                      </div>
                                    </div>
                                    <p>{item.texto}</p>
                                  </>
                                )}
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

                      {candidatosList.length > 0 ? (
                        <div className="cand-tracking-list">
                          {candidatosList.map((c) => (
                            <div key={c.id} className="cand-tracking-item">
                              <div className="cand-avatar">
                                {c.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div className="cand-body">
                                <div
                                  className="cand-body-top"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    if (expandedCandId === c.id) {
                                      setExpandedCandId(null);
                                    } else {
                                      setExpandedCandId(c.id);
                                      setEditForm({
                                        fase: c.fase,
                                        resultado: c.resultado,
                                        nota: c.notas || '',
                                      });
                                    }
                                  }}
                                >
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

                                {c.historial && c.historial.length > 0 && (
                                  <div className="cand-historial">
                                    {c.historial.map((h, idx) => (
                                      <div
                                        key={idx}
                                        className="cand-historial-item"
                                      >
                                        <span className="cand-historial-fase">
                                          {h.fase || h}
                                        </span>
                                        {h.fecha && (
                                          <span className="cand-historial-fecha">
                                            {h.fecha}
                                          </span>
                                        )}
                                        {h.nota && (
                                          <span className="cand-historial-nota">
                                            {h.nota}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {expandedCandId === c.id && (
                                  <div className="cand-edit-panel">
                                    <div className="cand-edit-row">
                                      <select
                                        className="cand-edit-select"
                                        value={editForm.fase}
                                        onChange={(e) =>
                                          setEditForm((f) => ({
                                            ...f,
                                            fase: e.target.value,
                                          }))
                                        }
                                      >
                                        {[
                                          'Enviado CV',
                                          'Entrevista telefónica',
                                          'Primera entrevista',
                                          'Segunda entrevista',
                                          'Prueba técnica',
                                          'Entrevista final',
                                          'Oferta enviada',
                                          'Contratado',
                                        ].map((f) => (
                                          <option key={f} value={f}>
                                            {f}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        className="cand-edit-select"
                                        value={editForm.resultado}
                                        onChange={(e) =>
                                          setEditForm((f) => ({
                                            ...f,
                                            resultado: e.target.value,
                                          }))
                                        }
                                      >
                                        {[
                                          'Pendiente',
                                          'Positivo',
                                          'Negativo',
                                          'En espera',
                                        ].map((r) => (
                                          <option key={r} value={r}>
                                            {r}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <textarea
                                      className="cand-edit-textarea"
                                      placeholder="Añadir nota..."
                                      value={editForm.nota}
                                      onChange={(e) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          nota: e.target.value,
                                        }))
                                      }
                                    />
                                    <div className="cand-edit-actions">
                                      <button
                                        className="btn-guardar-edit"
                                        onClick={() => handleGuardarEdicion(c)}
                                      >
                                        <i className="bi bi-floppy me-1"></i>
                                        Guardar
                                      </button>
                                      <button
                                        className="btn-icon btn-icon-sm btn-icon-danger"
                                        title="Eliminar candidato"
                                        onClick={() =>
                                          handleEliminarCandidato(c.id)
                                        }
                                      >
                                        <i className="bi bi-trash3"></i>
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {expandedCandId !== c.id && (
                                  <button
                                    className="btn-icon btn-icon-sm btn-icon-danger"
                                    title="Eliminar candidato"
                                    onClick={() =>
                                      handleEliminarCandidato(c.id)
                                    }
                                  >
                                    <i className="bi bi-trash3"></i>
                                  </button>
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
                      <h4 className="section-title">Adjuntar documentos</h4>

                      <div className="doc-upload-row mb-3">
                        <select
                          className="form-select input-field doc-tipo-select"
                          value={docTipo}
                          onChange={(e) => setDocTipo(e.target.value)}
                        >
                          <option>CV</option>
                          <option>Oferta económica</option>
                          <option>Contrato</option>
                          <option>Prueba técnica</option>
                          <option>Informe</option>
                          <option>Otro</option>
                        </select>
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
                        Archivos adjuntos{' '}
                        {localDocs.length > 0 && (
                          <span className="doc-count">{localDocs.length}</span>
                        )}
                      </h4>
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
                        <div className="tab-empty">
                          <i className="bi bi-file-earmark"></i>
                          <p>No hay documentos adjuntos todavía.</p>
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
      {/* MODAL DE RESULTADOS DE IA */}
      {showMatchModal && (
        <SmartMatchResults
          job={job}
          candidates={matchResults}
          onClose={() => setShowMatchModal(false)}
          onCandidatoAdded={() => {
            // Recargar la lista de candidatos
            const fetchCandidatos = async () => {
              const res = await authFetch(
                ENDPOINTS.recruitment.vacantes.candidateTracking(job.id)
              );
              if (!res.ok) return;
              const data = await res.json();
              setCandidatosList(
                data.map((c) => ({
                  id: c.id,
                  nombre: c.name,
                  fase: c.phase,
                  resultado: c.result || 'Pendiente',
                  notas: c.notes?.[0] || '',
                  historial: c.notes || [],
                  fecha: c.date
                    ? new Date(c.date).toLocaleDateString('es-ES')
                    : '',
                }))
              );
            };
            fetchCandidatos();
          }}
        />
      )}
    </>
  );
}
