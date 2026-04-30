import './ClienteCard.css';

export default function ClienteCard({
  cliente,
  isSelected,
  isBulkSelected,
  onBulkSelect,
  onClick,
  onEdit,
  onDelete,
  onTogglePrioritario,
}) {
  // Calculamos la inicial usando company_name o nombre
  const nombreParaMostrar =
    cliente.name || cliente.company_name || cliente.nombre || 'Desconocido';
  const initial = nombreParaMostrar.charAt(0).toUpperCase();

  return (
    <div
      className={`cliente-card ${isSelected ? 'active' : ''} ${cliente.prioritario ? 'prioritario' : ''}`}
      onClick={() => onClick(cliente)}
    >
      {/* ── Fila superior: checkbox + avatar + info + acciones ── */}
      <div className="cc-top">
        {onBulkSelect && (
          <input
            type="checkbox"
            className="cc-checkbox"
            checked={isBulkSelected || false}
            onChange={(e) => {
              e.stopPropagation();
              onBulkSelect(cliente.id);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Avatar con inicial */}
        <div
          className={`cc-avatar ${cliente.prioritario ? 'cc-avatar--vip' : ''}`}
        >
          {initial}
        </div>

        {/* Nombre + sector */}
        <div className="cc-info">
          <div className="cc-name-row">
            <span className="cc-nombre">{nombreParaMostrar}</span>
            {cliente.prioritario && (
              <i className="bi bi-star-fill cc-vip-icon" title="VIP"></i>
            )}
          </div>
          <span className="cc-sector-tag">
            {cliente.sector || 'Sin sector'}
          </span>
        </div>

        {/* Acciones: se muestran al hacer hover */}
        <div className="cc-actions">
          <button
            className={`cc-btn ${cliente.prioritario ? 'cc-btn--star-on' : ''}`}
            title={cliente.prioritario ? 'Quitar VIP' : 'Marcar como VIP'}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePrioritario(e, cliente);
            }}
          >
            <i
              className={`bi bi-star${cliente.prioritario ? '-fill' : ''}`}
            ></i>
          </button>
          <button
            className="cc-btn"
            title="Editar"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e, cliente);
            }}
          >
            <i className="bi bi-pencil"></i>
          </button>
          <button
            className="cc-btn cc-btn--danger"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e, cliente);
            }}
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>

      {/* ── Fila inferior: vacantes + contacto ── */}
      <div className="cc-bottom">
        <span className="cc-vacantes-badge">
          <i className="bi bi-briefcase me-1"></i>
          {cliente.vacantesAbiertas || 0}{' '}
          {cliente.vacantesAbiertas !== 1 ? 'vacantes' : 'vacante'}
        </span>
        <span className="cc-contacto">
          <i className="bi bi-person me-1"></i>
          {cliente.contactoPrincipal || 'Sin contacto'}
        </span>
      </div>
    </div>
  );
}
