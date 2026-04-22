import SourceOriginBadge from '../shared/SourceOriginBadge';
import './VacancyCard.css';

export default function VacancyCard({
  job,
  isListView,
  onClick,
  isSelected,
  onSelect,
  onUpdateStatus,
  onToggleFavorite,
}) {
  let badgeClass = 'badge-nueva';
  if (job.status === 'Contactada') badgeClass = 'badge-contactada';
  if (job.status === 'En proceso') badgeClass = 'badge-en-proceso';
  if (job.status === 'Descartada') badgeClass = 'badge-descartada';

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onSelect(job.id);
  };

  const handleChildClick = (e) => {
    e.stopPropagation();
  };

  const handleStatusChange = (e) => {
    e.stopPropagation();
    onUpdateStatus(job.id, e.target.value);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(job.id, job.isFavorite);
    }
  };

  // VISTA DE LISTA (Responsive Corregido)
  if (isListView) {
    return (
      <div className="vacante-card-list mb-2" onClick={onClick}>
        <div className="list-wrapper">
          <div className="list-main-info">
            <input
              className="form-check-input custom-checkbox"
              type="checkbox"
              checked={isSelected || false}
              onChange={handleCheckboxClick}
              onClick={handleChildClick}
            />
            <div className="list-text-group">
              <h5 className="list-title">{job.title}</h5>
              <span className="list-separator">|</span>
              <span className="list-company">{job.companyName}</span>
            </div>
          </div>

          <div className="list-meta-info">
            <div className="list-location">
              <i className="bi bi-geo-alt"></i>
              <span>{job.location}</span>
            </div>
            <div className="list-actions">
              <span className={`badge ${badgeClass}`}>{job.status}</span>
              <button
                className="btn-favorite-star"
                onClick={handleFavoriteClick}
              >
                <i
                  className={
                    job.isFavorite
                      ? 'bi bi-star-fill text-warning'
                      : 'bi bi-star'
                  }
                ></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA DE GRID (Tarjetas normales)
  return (
    <div className="vacante-card" onClick={onClick}>
      <div className="card-header-row">
        <div className="header-left">
          <input
            className="form-check-input checkbox-lg"
            type="checkbox"
            checked={isSelected || false}
            onChange={handleCheckboxClick}
            onClick={handleChildClick}
          />
          <select
            className={`form-select form-select-sm select-status-inline ${badgeClass}`}
            value={job.status}
            onChange={handleStatusChange}
            onClick={handleChildClick}
          >
            <option value="Nueva">Nueva</option>
            <option value="Contactada">Contactada</option>
            <option value="En proceso">En proceso</option>
            <option value="Descartada">Descartada</option>
          </select>
        </div>
        <button className="btn-favorite-star" onClick={handleFavoriteClick}>
          <i
            className={
              job.isFavorite ? 'bi bi-star-fill text-warning' : 'bi bi-star'
            }
          ></i>
        </button>
      </div>

      <h3 className="vacante-title">{job.title}</h3>

      <div className="vacante-details">
        <div className="detail-item">
          <div className="detail-icon icon-purple">
            <i className="bi bi-building"></i>
          </div>
          <div className="d-flex flex-column">
            <span className="detail-text">{job.companyName}</span>
            {job.isClient && (
              <span className="badge mt-1 badge-client">Cliente Activo</span>
            )}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-icon icon-cyan">
            <i className="bi bi-geo-alt"></i>
          </div>
          <span className="detail-text">{job.location}</span>
        </div>
      </div>

      <div className="vacante-footer">
        <SourceOriginBadge source={job.source} />
        <span className="vacante-date">{job.time}</span>
      </div>
    </div>
  );
}
