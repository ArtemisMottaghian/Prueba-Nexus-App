import { useState } from 'react';
import './CrmEmpresaPanel.css';

/**
 * CrmEmpresaPanel — Seguimiento comercial vinculado a la EMPRESA.
 *
 * Issue #329: el seguimiento comercial NO está ligado a la vacante, sino a la empresa.
 * Esta vista es reutilizable tanto en el detalle de vacante (VacancyModal) como
 * en el detalle de cliente (ClienteDetail).
 *
 * Props:
 *  - empresa: objeto cliente con { nombre, estadoCuenta, responsable, ultimoContacto,
 *             acuerdos, historialComercial, documentosComerciales, vacantes }
 *  - compact: bool — layout más compacto (modal de vacante)
 *  - onUpdateEstadoCuenta: (nuevoEstado) => void — se invoca al cambiar de estado.
 *    Al convertir a 'cliente' (firma), el consumidor debe propagar el cambio en todo el sistema.
 */
export default function CrmEmpresaPanel({
  empresa,
  compact = false,
  onUpdateEstadoCuenta,
}) {
  const [confirmFirma, setConfirmFirma] = useState(false);

  if (!empresa) {
    return (
      <div className="crm-empty">
        <i className="bi bi-building-x"></i>
        <p className="mb-1 fw-semibold">Empresa no registrada en el CRM</p>
        <small className="text-muted">
          Esta vacante proviene de una empresa que todavía no existe como
          cliente. Registra la empresa para centralizar su seguimiento
          comercial.
        </small>
      </div>
    );
  }

  const estadoActual = empresa.estadoCuenta || 'lead';

  const estadoMeta = {
    lead: { label: 'Lead', className: 'estado-lead', icon: 'bi-lightbulb' },
    contactada: {
      label: 'Contactada',
      className: 'estado-contactada',
      icon: 'bi-telephone-outbound',
    },
    en_negociacion: {
      label: 'En negociación',
      className: 'estado-negociacion',
      icon: 'bi-chat-dots',
    },
    cliente: {
      label: 'Cliente',
      className: 'estado-cliente',
      icon: 'bi-patch-check-fill',
    },
  };

  const iconoTipoInteraccion = {
    email: 'bi-envelope',
    reunion: 'bi-people',
    demo: 'bi-laptop',
    firma: 'bi-pen',
    contacto: 'bi-telephone',
    nota: 'bi-journal-text',
  };

  const cambiarEstado = (nuevoEstado) => {
    if (nuevoEstado === estadoActual) return;
    // La transición a "cliente" representa la firma del contrato → confirmación
    if (nuevoEstado === 'cliente') {
      setConfirmFirma(true);
      return;
    }
    onUpdateEstadoCuenta?.(nuevoEstado);
  };

  const confirmarFirma = () => {
    setConfirmFirma(false);
    onUpdateEstadoCuenta?.('cliente');
  };

  return (
    <div className={`crm-empresa-panel ${compact ? 'compact' : ''}`}>
      {/* Cabecera: estado de cuenta + responsable */}
      <div className="crm-head">
        <div className="crm-head-main">
          <div className="crm-head-titulo">
            <i className="bi bi-building me-2"></i>
            <span>{empresa.nombre}</span>
          </div>
          <div className="crm-head-meta">
            <span
              className={`estado-cuenta-chip ${
                estadoMeta[estadoActual]?.className || 'estado-lead'
              }`}
            >
              <i
                className={`bi ${estadoMeta[estadoActual]?.icon || 'bi-circle'} me-1`}
              ></i>
              {estadoMeta[estadoActual]?.label || estadoActual}
            </span>
            {empresa.responsable && (
              <span className="crm-responsable">
                <i className="bi bi-person-circle me-1"></i>
                Responsable: <strong>{empresa.responsable}</strong>
              </span>
            )}
            {empresa.ultimoContacto && (
              <span className="crm-ultimo-contacto">
                <i className="bi bi-clock-history me-1"></i>
                Último contacto: {empresa.ultimoContacto}
              </span>
            )}
          </div>
        </div>

        {/* Selector de estado (flujo comercial) */}
        <div className="crm-head-actions">
          <label className="crm-estado-label">Estado de cuenta</label>
          <div className="crm-estado-pills">
            {['lead', 'contactada', 'en_negociacion', 'cliente'].map((e) => (
              <button
                key={e}
                type="button"
                className={`crm-estado-pill ${estadoMeta[e].className} ${
                  estadoActual === e ? 'active' : ''
                }`}
                onClick={() => cambiarEstado(e)}
                title={
                  e === 'cliente'
                    ? 'Convertir a cliente (firma de contrato)'
                    : estadoMeta[e].label
                }
              >
                <i className={`bi ${estadoMeta[e].icon} me-1`}></i>
                {estadoMeta[e].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="crm-stats">
        <div className="crm-stat">
          <span className="crm-stat-value">
            {empresa.vacantes?.length || 0}
          </span>
          <span className="crm-stat-label">Vacantes vinculadas</span>
        </div>
        <div className="crm-stat">
          <span className="crm-stat-value">
            {empresa.historialComercial?.length || 0}
          </span>
          <span className="crm-stat-label">Interacciones</span>
        </div>
        <div className="crm-stat">
          <span className="crm-stat-value">
            {empresa.documentosComerciales?.length || 0}
          </span>
          <span className="crm-stat-label">Documentos</span>
        </div>
        <div className="crm-stat">
          <span className="crm-stat-value">
            {empresa.acuerdos?.length || 0}
          </span>
          <span className="crm-stat-label">Acuerdos</span>
        </div>
      </div>

      {/* Historial de interacciones */}
      <div className="crm-section">
        <h6 className="crm-section-title">
          <i className="bi bi-list-check me-2"></i>
          Historial de interacciones
        </h6>
        {empresa.historialComercial?.length > 0 ? (
          <ul className="crm-timeline">
            {empresa.historialComercial.map((h, i) => (
              <li key={i} className="crm-timeline-item">
                <span className="crm-timeline-dot">
                  <i
                    className={`bi ${iconoTipoInteraccion[h.tipo] || 'bi-circle-fill'}`}
                  ></i>
                </span>
                <div className="crm-timeline-card">
                  <p className="mb-1">{h.texto}</p>
                  <div className="crm-timeline-meta">
                    <span>
                      <i className="bi bi-clock me-1"></i>
                      {h.fecha}
                    </span>
                    {h.autor && (
                      <span>
                        <i className="bi bi-person me-1"></i>
                        {h.autor}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted small mb-0">
            No hay interacciones registradas todavía.
          </p>
        )}
      </div>

      {/* Acuerdos */}
      {empresa.acuerdos?.length > 0 && (
        <div className="crm-section">
          <h6 className="crm-section-title">
            <i className="bi bi-handshake me-2"></i>Acuerdos
          </h6>
          <ul className="crm-acuerdos">
            {empresa.acuerdos.map((a, i) => (
              <li key={i}>
                <i className="bi bi-check2-circle me-2"></i>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documentos adjuntos */}
      <div className="crm-section">
        <h6 className="crm-section-title">
          <i className="bi bi-folder2-open me-2"></i>
          Documentos adjuntos
        </h6>
        {empresa.documentosComerciales?.length > 0 ? (
          empresa.documentosComerciales.map((d, i) => (
            <div key={i} className="crm-doc-item">
              <div className="crm-doc-icon">
                <i className="bi bi-file-earmark-text"></i>
              </div>
              <div className="flex-grow-1">
                <div className="crm-doc-name">{d.nombre}</div>
                <div className="crm-doc-meta">
                  {d.tipo} · {d.fecha}
                </div>
              </div>
              <button className="btn-icon btn-icon-sm" title="Descargar">
                <i className="bi bi-download"></i>
              </button>
            </div>
          ))
        ) : (
          <p className="text-muted small mb-0">
            No hay documentos adjuntos (ej. acuerdos de colaboración).
          </p>
        )}
      </div>

      {/* Modal confirmación firma (conversión a cliente) */}
      {confirmFirma && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title">
                    <i className="bi bi-patch-check-fill text-success me-2"></i>
                    Convertir a cliente
                  </h5>
                  <button
                    className="btn-close"
                    onClick={() => setConfirmFirma(false)}
                  ></button>
                </div>
                <div className="modal-body pt-2">
                  <p className="mb-1">
                    ¿Confirmas que <strong>{empresa.nombre}</strong> firma el
                    contrato y pasa a ser cliente?
                  </p>
                  <p className="text-muted small mb-0">
                    <i className="bi bi-info-circle me-1"></i>
                    El estado se actualizará en todo el sistema — todas las
                    vacantes de esta empresa reflejarán el nuevo estado.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setConfirmFirma(false)}
                  >
                    Cancelar
                  </button>
                  <button className="btn btn-success" onClick={confirmarFirma}>
                    <i className="bi bi-check-circle me-2"></i>
                    Confirmar firma
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
