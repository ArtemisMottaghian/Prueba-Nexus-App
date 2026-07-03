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
    if (onVerify) onVerify(candidate.id, !candidate.verified);
  };

  if (isListView) {
    return (
      <div
        className="vacante-card-list mb-2"
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between w-100 p-3 gap-3">
          <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-2 gap-lg-3 w-100">
            <div className="d-flex align-items-center gap-2">
              <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isSelected || false}
                onChange={handleCheckboxClick}
                onClick={handleChildClick}
              />
              <h5 className="mb-0 text-body vacante-title-list-sm">
                {candidate.name}
              </h5>
            </div>
            <span className="text-muted small d-none d-lg-block">|</span>
            <span className="detail-text">{candidate.specialty}</span>
            <span className="text-muted small d-none d-lg-block">|</span>
            <span className="detail-text text-muted small">
              {candidate.experience || 'Experiencia no indicada'}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-start justify-content-lg-end w-100">
            <span className="detail-text opacity-75">
              <i className="bi bi-geo-alt me-1"></i>
              {candidate.location}
            </span>
            {candidate.verified && (
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                <i className="bi bi-patch-check-fill me-1" />
                Verificado
              </span>
            )}
            {onVerify && (
              <button
                type="button"
                className={`btn btn-sm py-0 px-2 ${
                  candidate.verified ? 'btn-outline-danger' : 'btn-primary'
                }`}
                onClick={handleVerify}
              >
                {candidate.verified ? 'Quitar' : 'Verificar'}
              </button>
            )}
            <span className={`badge ${badgeClass}`}>{statusText}</span>
            <button
              className={`btn-icon btn-icon-sm ${
                candidate.isFavorite ? 'text-warning' : ''
              }`}
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
      <div
        className="card-header-row d-flex align-items-center mb-2"
        style={{ justifyContent: 'space-evenly', gap: '8px' }}
      >
        <input
          className="form-check-input mt-0 checkbox-lg"
          type="checkbox"
          checked={isSelected || false}
          onChange={handleCheckboxClick}
          onClick={handleChildClick}
          style={{ flexShrink: 0, width: '18px', height: '18px' }}
        />
        <select
          className={`form-select form-select-sm select-status-inline ${badgeClass}`}
          value={candidate.status}
          onChange={handleStatusChange}
          onClick={handleChildClick}
          style={{ minWidth: '90px', textAlignLast: 'center' }}
        >
          {CANDIDATE_STATUS_SELECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {onVerify && (
          <button
            type="button"
            className={`btn btn-sm ${
              candidate.verified ? 'btn-outline-danger' : 'btn-primary'
            }`}
            onClick={handleVerify}
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
            }}
          >
            {candidate.verified ? 'Quitar' : 'Verificar'}
          </button>
        )}
        <button
          className={`btn-icon btn-icon-sm ${
            candidate.isFavorite ? 'text-warning' : ''
          }`}
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

      <h3 className="vacante-title">{candidate.name}</h3>

      <div className="vacante-details">
        <div className="detail-item">
          <div className="detail-icon icon-purple mt-1 align-self-start">
            <i className="bi bi-person-badge"></i>
          </div>
          <div className="d-flex flex-column gap-1">
            <span className="detail-text">{candidate.specialty}</span>
            <div className="d-flex flex-wrap gap-1 mt-1">
              {candidate.isAvailable && (
                <span
                  className="badge badge-disponible d-inline-flex align-items-center"
                  style={{ width: 'fit-content' }}
                >
                  DISPONIBLE
                </span>
              )}
              {candidate.verified && (
                <span
                  className="badge bg-success-subtle text-success d-inline-flex align-items-center"
                  style={{ width: 'fit-content' }}
                >
                  <i className="bi bi-patch-check-fill me-1" />
                  VERIFICADO
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-icon icon-cyan">
            <i className="bi bi-geo-alt"></i>
          </div>
          <span className="detail-text">{candidate.location}</span>
        </div>

        <div className="detail-item">
          <div className="detail-icon icon-orange mt-1 align-self-start">
            <i className="bi bi-briefcase"></i>
          </div>
          <span className="detail-text text-break">
            {candidate.experience || 'Experiencia no indicada'}
          </span>
        </div>

        <div className="detail-item">
          <div className="detail-icon icon-gray mt-1 align-self-start">
            <i className="bi bi-envelope"></i>
          </div>
          <span className="detail-text text-break">
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
