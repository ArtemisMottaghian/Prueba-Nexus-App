import SourceOriginBadge from '../shared/SourceOriginBadge';
import {
  CANDIDATE_STATUS_SELECT_OPTIONS,
  candidateStatusBadgeClass,
  candidateStatusLabel,
} from '../../../constants/candidateStatus';
import './CandidateCard.css';

export default function CandidateCard({
  candidate,
  isListView,
  onClick,
  isSelected,
  onSelect,
  onUpdateStatus,
  onToggleFavorite,
  onVerify,
}) {
  const badgeClass = candidateStatusBadgeClass(candidate.status);
  const statusText = candidateStatusLabel(candidate.status);

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

  const handleVerify = (e) => {
    e.stopPropagation();
    if (onVerify && !candidate.verified) onVerify(candidate.id);
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
              onClick={handleChildClick}
            />
            <h5 className="mb-0 text-body vacante-title-list-sm">
              {candidate.name}
            </h5>
            <span className="text-muted small">|</span>
            <span className="detail-text">{candidate.specialty}</span>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <span className="detail-text opacity-75">
              <i className="bi bi-geo-alt me-1"></i>
              {candidate.location}
            </span>
            {candidate.verified ? (
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                <i className="bi bi-patch-check-fill me-1" />
                Verificado
              </span>
            ) : (
              onVerify && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary py-0 px-2"
                  onClick={handleVerify}
                >
                  Verificar
                </button>
              )
            )}
            <span className={`badge ${badgeClass}`}>{statusText}</span>
            <button
              className={`btn-icon btn-icon-sm ${candidate.isFavorite ? 'text-warning' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(candidate.id, candidate.isFavorite);
              }}
            >
              <i
                className={
                  candidate.isFavorite ? 'bi bi-star-fill' : 'bi bi-star'
                }
              ></i>
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
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <input
            className="form-check-input mt-0 checkbox-lg"
            type="checkbox"
            checked={isSelected || false}
            onChange={handleCheckboxClick}
            onClick={handleChildClick}
          />
          <select
            className={`form-select form-select-sm select-status-inline ${badgeClass}`}
            value={candidate.status}
            onChange={handleStatusChange}
            onClick={handleChildClick}
          >
            {CANDIDATE_STATUS_SELECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {onVerify && !candidate.verified && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={handleVerify}
            >
              Verificar
            </button>
          )}
        </div>
        <button
          className={`btn-icon btn-icon-sm ${candidate.isFavorite ? 'text-warning' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(candidate.id, candidate.isFavorite);
          }}
        >
          <i
            className={candidate.isFavorite ? 'bi bi-star-fill' : 'bi bi-star'}
          ></i>
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
              <span className="badge mt-1 badge-disponible">Disponible</span>
            )}
            {candidate.verified && (
              <span className="badge mt-1 bg-success-subtle text-success">
                <i className="bi bi-patch-check-fill me-1" />
                Verificado
              </span>
            )}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-icon icon-cyan">
            <i className="bi bi-geo-alt"></i>
          </div>
          <span className="detail-text">{candidate.location}</span>
        </div>
        <div className="detail-item">
          <div className="detail-icon icon-purple">
            <i className="bi bi-envelope"></i>
          </div>
          <span className="detail-text">
            {candidate.email || 'No indicado'}
          </span>
        </div>
      </div>

      <div className="vacante-footer">
        <SourceOriginBadge source={candidate.source} />
        <span className="vacante-date">{candidate.time}</span>
      </div>
    </div>
  );
}
