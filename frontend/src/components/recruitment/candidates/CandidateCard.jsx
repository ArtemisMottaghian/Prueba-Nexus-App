import './CandidateCard.css';

export default function CandidateCard({
  candidate,
  isListView,
  onClick,
  isSelected,
  onSelect,
  onUpdateStatus,
}) {
  let badgeClass = 'badge-nueva';
  if (candidate.status === 'Contactado') badgeClass = 'badge-contactada';
  if (candidate.status === 'En proceso') badgeClass = 'badge-en-proceso';
  if (candidate.status === 'Descartado') badgeClass = 'badge-descartada';

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onSelect(candidate.id);
  };

  const handleChildClick = (e) => {
    e.stopPropagation();
  };

  const handleStatusChange = (e) => {
    e.stopPropagation();
    onUpdateStatus(candidate.id, e.target.value);
  };

  if (isListView) {
    return (
      <div
        className="vacante-card-list mb-2"
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center justify-content-between w-100 p-3">
          <div className="d-flex align-items-center gap-3">
            <input
              className="form-check-input"
              type="checkbox"
              checked={isSelected || false}
              onChange={handleCheckboxClick}
            />
            {/* CAMBIO AQUÍ: text-white -> text-body */}
            <h5 className="mb-0 text-body vacante-title-list-sm">
              {candidate.name}
            </h5>
            <span className="text-muted small">|</span>
            <span className="detail-text">{candidate.specialty}</span>
          </div>
          <div className="d-flex align-items-center gap-4">
            <span className="detail-text opacity-75">
              <i className="bi bi-geo-alt me-1"></i>
              {candidate.location}
            </span>
            <span className={`badge ${badgeClass}`}>{candidate.status}</span>
            <button className="btn-icon btn-icon-sm" onClick={handleChildClick}>
              <i className="bi bi-star"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="vacante-card"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-header-row">
        <div className="d-flex align-items-center gap-2">
          <input
            className="form-check-input mt-0 checkbox-lg"
            type="checkbox"
            checked={isSelected || false}
            onChange={handleCheckboxClick}
          />
          <select
            className={`form-select form-select-sm select-status-inline ${badgeClass}`}
            value={candidate.status}
            onChange={handleStatusChange}
            onClick={handleChildClick}
          >
            <option value="Nuevo">Nuevo</option>
            <option value="Contactado">Contactado</option>
            <option value="En proceso">En proceso</option>
            <option value="Descartado">Descartado</option>
          </select>
        </div>
        <button className="btn-icon btn-icon-sm" onClick={handleChildClick}>
          <i className="bi bi-star"></i>
        </button>
      </div>

      <h3 className="vacante-title">{candidate.name}</h3>

      <div className="vacante-details">
        <div className="detail-item">
          <div className="detail-icon icon-purple">
            <i className="bi bi-person-badge"></i>
          </div>
          <div className="d-flex flex-column">
            <span className="detail-text">{candidate.specialty}</span>
            {candidate.isAvailable && (
              <span className="badge mt-1 badge-client">Disponible</span>
            )}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-icon icon-cyan">
            <i className="bi bi-geo-alt"></i>
          </div>
          <span className="detail-text">{candidate.location}</span>
        </div>
      </div>

      <div className="vacante-footer">
        <div className="origin-badge">
          <i className="bi bi-linkedin"></i>
          <span>{candidate.source}</span>
        </div>
        <span className="vacante-date">{candidate.time}</span>
      </div>
    </div>
  );
}
