import './ClienteDetail.css';
const getBadgeEstado = (estado) => {
  const map = {
    Nueva: 'badge-nueva',
    Contactada: 'badge-contactada',
    'En proceso': 'badge-en-proceso',
    Descartada: 'badge-descartada',
  };
  return map[estado] || 'badge-nueva';
};

export default function ClienteDetail({ cliente, onEdit, onDelete }) {
  if (!cliente) {
    return (
      <div className="clientes-empty-state">
        <i className="bi bi-building fs-1 mb-3 d-block"></i>
        <h5>Selecciona un cliente</h5>
        <p className="text-muted">
          Haz clic en un cliente de la lista para ver sus datos y vacantes
          asociadas.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="cliente-profile-header mb-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h3 className="cliente-profile-nombre">{cliente.nombre}</h3>
            <span className="cliente-sector">{cliente.sector}</span>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="cliente-vacantes-badge grande">
              {cliente.vacantesAbiertas} vacantes abiertas
            </span>
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={(e) => onEdit(e, cliente)}
            >
              <i className="bi bi-pencil"></i>
              <span className="d-none d-sm-inline">Editar</span>
            </button>
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={(e) => onDelete(e, cliente)}
            >
              <i className="bi bi-trash"></i>
              <span className="d-none d-sm-inline">Eliminar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {/* Datos de contacto */}
        <div className="col-12 col-lg-6">
          <div className="cliente-info-card h-100">
            <h6 className="info-card-title">
              <i className="bi bi-person-badge me-2"></i>Datos de contacto
            </h6>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Contacto principal</span>
                <span className="info-value">{cliente.contactoPrincipal}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email</span>
                <a
                  href={`mailto:${cliente.email}`}
                  className="info-value text-decoration-none"
                >
                  <i className="bi bi-envelope me-1 text-muted"></i>
                  {cliente.email}
                </a>
              </div>
              <div className="info-item">
                <span className="info-label">Teléfono</span>
                <a
                  href={`tel:${cliente.telefono}`}
                  className="info-value text-decoration-none"
                >
                  <i className="bi bi-telephone me-1 text-muted"></i>
                  {cliente.telefono}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Datos fiscales */}
        <div className="col-12 col-lg-6">
          <div className="cliente-info-card h-100">
            <h6 className="info-card-title">
              <i className="bi bi-building me-2"></i>Datos fiscales
            </h6>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">CIF</span>
                <span className="info-value">{cliente.cif || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Dirección</span>
                <span className="info-value">{cliente.direccion || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vacantes vinculadas */}
      <div className="cliente-info-card">
        <h6 className="info-card-title mb-3">
          <i className="bi bi-briefcase me-2"></i>
          Vacantes vinculadas ({cliente.vacantes.length})
        </h6>
        {cliente.vacantes.length > 0 ? (
          cliente.vacantes.map((v) => (
            <div
              key={v.id}
              className="vacante-vinculada d-flex align-items-center justify-content-between mb-2"
              style={{ cursor: 'default' }}
            >
              <div>
                <p className="mb-0 vacante-vinculada-titulo">{v.titulo}</p>
                <span className="activity-time">{v.fecha}</span>
              </div>
              <span className={`badge ${getBadgeEstado(v.estado)}`}>
                {v.estado}
              </span>
            </div>
          ))
        ) : (
          <p className="text-muted small mb-0">No hay vacantes vinculadas.</p>
        )}
      </div>
    </>
  );
}
