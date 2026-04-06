import './ClienteCard.css';

export default function ClienteCard({
  cliente,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  onTogglePrioritario,
}) {
  return (
    <div
      className={`cliente-card ${isSelected ? 'active' : ''} ${cliente.prioritario ? 'prioritario' : ''}`}
      onClick={() => onClick(cliente)}
    >
      <div className="d-flex justify-content-between align-items-start">
        <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h6 className="cliente-nombre mb-0 text-truncate">
              {cliente.nombre}
            </h6>
            {cliente.prioritario && (
              <i className="bi bi-star-fill cliente-vip-icon flex-shrink-0"></i>
            )}
          </div>
          <span className="cliente-sector">{cliente.sector}</span>
        </div>
        <div className="d-flex align-items-center gap-1 flex-shrink-0">
          <span className="cliente-vacantes-badge me-1">
            {cliente.vacantesAbiertas}{' '}
            {cliente.vacantesAbiertas !== 1 ? 'vacantes' : 'vacante'}
          </span>
          <button
            className={`btn-icon btn-icon-sm ${cliente.prioritario ? 'text-warning' : ''}`}
            title={cliente.prioritario ? 'Quitar VIP' : 'Marcar como VIP'}
            onClick={(e) => onTogglePrioritario(e, cliente)}
          >
            <i
              className={`bi bi-star${cliente.prioritario ? '-fill' : ''}`}
            ></i>
          </button>
          <button
            className="btn-icon btn-icon-sm"
            title="Editar cliente"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e, cliente);
            }}
          >
            <i className="bi bi-pencil"></i>
          </button>
          <button
            className="btn-icon btn-icon-sm text-danger"
            title="Eliminar cliente"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e, cliente);
            }}
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div className="cliente-contacto mt-2">
        <i className="bi bi-person me-1"></i>
        {cliente.contactoPrincipal}
      </div>
    </div>
  );
}
