import './ClienteCard.css';

export default function ClienteCard({
  cliente,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  onTogglePrioritario,
}) {
  // Función helper para evitar repetición de stopPropagation
  const handleAction = (e, callback) => {
    e.stopPropagation();
    callback(e, cliente);
  };

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
              <i
                className="bi bi-star-fill cliente-vip-icon"
                title="Cliente Prioritario"
              ></i>
            )}
          </div>
          <span className="cliente-sector">{cliente.sector}</span>
        </div>

        <div className="d-flex align-items-center gap-1 flex-shrink-0">
          <span className="cliente-vacantes-badge me-1">
            {cliente.vacantesAbiertas}{' '}
            {cliente.vacantesAbiertas !== 1 ? 'vacantes' : 'vacante'}
          </span>

          {/* Botón Favorito/VIP */}
          <button
            className={`btn-icon btn-icon-sm ${cliente.prioritario ? 'text-warning' : ''}`}
            title={
              cliente.prioritario
                ? 'Quitar prioridad'
                : 'Marcar como prioritario'
            }
            onClick={(e) => handleAction(e, onTogglePrioritario)}
          >
            <i
              className={`bi bi-star${cliente.prioritario ? '-fill' : ''}`}
            ></i>
          </button>

          {/* Botón Editar */}
          <button
            className="btn-icon btn-icon-sm"
            title="Editar cliente"
            onClick={(e) => handleAction(e, onEdit)}
          >
            <i className="bi bi-pencil"></i>
          </button>

          {/* Botón Eliminar */}
          <button
            className="btn-icon btn-icon-sm text-danger"
            title="Eliminar cliente"
            onClick={(e) => handleAction(e, onDelete)}
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div className="cliente-contacto mt-2">
        <i className="bi bi-person-badge me-2 opacity-75"></i>
        {cliente.contactoPrincipal}
      </div>
    </div>
  );
}
