import './ClienteCard.css';
export default function ClienteCard({
  cliente,
  isSelected,
  onClick,
  onEdit,
  onDelete,
}) {
  return (
    <div
      className={`cliente-card ${isSelected ? 'active' : ''}`}
      onClick={() => onClick(cliente)}
    >
      <div className="d-flex justify-content-between align-items-start">
        <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
          <h6 className="cliente-nombre mb-1 text-truncate">
            {cliente.nombre}
          </h6>
          <span className="cliente-sector">{cliente.sector}</span>
        </div>
        <div className="d-flex align-items-center gap-1 flex-shrink-0">
          <span className="cliente-vacantes-badge me-1">
            {cliente.vacantesAbiertas}{' '}
            {cliente.vacantesAbiertas !== 1 ? 'vacantes' : 'vacante'}
          </span>
          {/* Botón editar */}
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
          {/* Botón eliminar */}
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
