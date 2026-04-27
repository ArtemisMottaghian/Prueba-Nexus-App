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
  return (
    <div
      className={`cliente-card ${isSelected ? 'active' : ''} ${cliente.prioritario ? 'prioritario' : ''} mb-2`}
      onClick={() => onClick(cliente)}
      style={{ cursor: 'pointer' }}
    >
      <div className="d-flex justify-content-between align-items-start">
        <div
          className="d-flex flex-grow-1 me-2 align-items-start"
          style={{ minWidth: 0 }}
        >
          {onBulkSelect && (
            <div className="mt-1 me-3">
              <input
                type="checkbox"
                className="form-check-input custom-checkbox"
                style={{ width: '1.2em', height: '1.2em', cursor: 'pointer' }}
                checked={isBulkSelected || false}
                onChange={(e) => {
                  e.stopPropagation();
                  onBulkSelect(cliente.id);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div style={{ minWidth: 0 }}>
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
        </div>

        <div className="d-flex align-items-center gap-1 flex-shrink-0">
          <span className="cliente-vacantes-badge me-1">
            {cliente.vacantesAbiertas}{' '}
            {cliente.vacantesAbiertas !== 1 ? 'vacantes' : 'vacante'}
          </span>
          <button
            className={`btn-icon btn-icon-sm ${cliente.prioritario ? 'text-warning' : ''}`}
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
      <div className={`cliente-contacto mt-2 ${onBulkSelect ? 'ms-4' : ''}`}>
        <i className="bi bi-person me-1"></i>
        {cliente.contactoPrincipal}
      </div>
    </div>
  );
}
