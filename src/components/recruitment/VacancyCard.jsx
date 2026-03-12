export default function VacancyCard({ job, isListView, onClick }) { 
  let badgeClass = "badge-nueva";
  if (job.status === "Contactada") badgeClass = "badge-contactada";
  if (job.status === "En proceso") badgeClass = "badge-en-proceso";
  if (job.status === "Descartada") badgeClass = "badge-descartada";

  // Función para evitar que el modal se abra si solo queremos marcar el checkbox o cambiar el estado
  const handleChildClick = (e) => {
    e.stopPropagation(); 
  };

  // Diseño para Modo Lista
  if (isListView) {
    return (
      <div className="vacante-card-list mb-2" onClick={onClick} style={{ cursor: 'pointer' }}>
        <div className="d-flex align-items-center justify-content-between w-100 p-3">
          <div className="d-flex align-items-center gap-3">
            <input className="form-check-input" type="checkbox" onClick={handleChildClick} />
            <h5 className="mb-0 text-white vacante-title-list-sm">{job.title}</h5>
            <span className="text-muted small">|</span>
            <span className="detail-text">{job.companyName}</span>
          </div>
          <div className="d-flex align-items-center gap-4">
            <span className="detail-text opacity-75"><i className="bi bi-geo-alt me-1"></i>{job.location}</span>
            <span className={`badge ${badgeClass}`}>{job.status}</span>
            <button className="btn-icon btn-icon-sm" onClick={handleChildClick}><i className="bi bi-star"></i></button>
          </div>
        </div>
      </div>
    );
  }

  // Diseño para Modo Grid
  return (
    <div className="vacante-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-header-row">
        <div className="d-flex align-items-center gap-2">
          <input 
            className="form-check-input mt-0 checkbox-lg" 
            type="checkbox" 
            onClick={handleChildClick} 
          />
          <select 
            className={`form-select form-select-sm select-status-inline ${badgeClass}`} 
            defaultValue={job.status}
            onClick={handleChildClick}
          >
            <option value="Nueva">Nueva</option>
            <option value="Contactada">Contactada</option>
            <option value="En proceso">En proceso</option>
          </select>
        </div>
        <button className="btn-icon btn-icon-sm" onClick={handleChildClick}><i className="bi bi-star"></i></button>
      </div>
      
      <h3 className="vacante-title">{job.title}</h3>
      
      <div className="vacante-details">
        <div className="detail-item">
          <div className="detail-icon icon-purple"><i className="bi bi-building"></i></div>
          <div className="d-flex flex-column">
            <span className="detail-text">{job.companyName}</span>
            {job.isClient && <span className="badge mt-1 badge-client">Cliente Activo</span>}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-icon icon-cyan"><i className="bi bi-geo-alt"></i></div>
          <span className="detail-text">{job.location}</span>
        </div>
      </div>
      
      <div className="vacante-footer">
        <div className="origin-badge"><i className="bi bi-linkedin"></i><span>{job.source}</span></div>
        <span className="vacante-date">{job.time}</span>
      </div>
    </div>
  );
}