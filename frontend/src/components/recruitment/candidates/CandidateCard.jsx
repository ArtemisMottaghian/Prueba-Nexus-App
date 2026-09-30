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
          <div className="cl-left d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-2 gap-lg-3 w-100">
            <div className="cl-namebox d-flex align-items-center gap-2">
              <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isSelected || false}
                onChange={handleCheckboxClick}
                onClick={handleChildClick}
              />
              <h5
                className="cl-name mb-0 text-body vacante-title-list-sm"
                title={candidate.name}
              >
                {candidate.name}
              </h5>
            </div>
            <span className="text-muted small d-none d-lg-block">|</span>
            <span className="detail-text" title={candidate.specialty}>
              {candidate.specialty}
            </span>
            <span className="text-muted small d-none d-lg-block">|</span>
            <span
              className="detail-text text-muted small"
              title={candidate.experience || ''}
            >
              {/* Solo la primera linea (puesto mas reciente); el detalle va en la ficha */}
              {(candidate.experience || '').split('\n')[0] ||
                'Experiencia no indicada'}
            </span>
          </div>

          <div className="cl-right d-flex align-items-center gap-2 flex-wrap justify-content-start justify-content-lg-end w-100">
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
                  candidate.verified ? 'btn-outline-danger' : 'btn-nexus'
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
      <div className="card-header-row d-flex align-items-center gap-2 mb-2">
        <input
          className="form-check-input mt-0 checkbox-lg"
          type="checkbox"
          checked={isSelected || false}
          onChange={handleCheckboxClick}
          onClick={handleChildClick}
          style={{ flexShrink: 0, width: '18px', height: '18px' }}
        />
        <div className="ms-auto d-flex align-items-center gap-2">
          {onVerify && (
            <button
              type="button"
              className={`btn btn-sm ${
                candidate.verified ? 'btn-outline-danger' : 'btn-nexus'
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
      </div>

      {/* El estado va en su propia fila, con el ancho de la tarjeta, para que se lea entero */}
      <select
        className={`form-select form-select-sm select-status-inline card-status mb-2 ${badgeClass}`}
        value={candidate.status}
        onChange={handleStatusChange}
        onClick={handleChildClick}
        style={{ textAlignLast: 'center' }}
      >
        {CANDIDATE_STATUS_SELECT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <h3 className="vacante-title">{candidate.name}</h3>

      {candidate.managedByName && (
        <div className="candidate-recruiter">
          <i className="bi bi-person-check"></i>
          Reclutador/a: {candidate.managedByName}
        </div>
      )}

      <div className="vacante-details">
        <div className="detail-item">
          <div className="detail-icon icon-purple mt-1 align-self-start">
            <i className="bi bi-person-badge"></i>
          </div>
          <div className="d-flex flex-column gap-1">
            <span
              className="detail-text cc-2l"
              title={candidate.specialty || ''}
            >
              {candidate.specialty || 'No indicada'}
            </span>
            <div className="d-flex flex-wrap gap-1 mt-1">
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
          <span className="detail-text" title={candidate.location || ''}>
            {candidate.location || 'No indicada'}
          </span>
        </div>

        <div className="detail-item">
          <div className="detail-icon icon-orange mt-1 align-self-start">
            <i className="bi bi-briefcase"></i>
          </div>
          {/* Solo el puesto actual (primera línea); la trayectoria completa va en la ficha */}
          <span
            className="detail-text text-break cc-2l"
            title={candidate.experience || ''}
          >
            {(candidate.experience || '').split('\n')[0] || 'No indicada'}
          </span>
        </div>

        <div className="detail-item">
          <div className="detail-icon icon-green mt-1 align-self-start">
            <i className="bi bi-mortarboard"></i>
          </div>
          <span
            className="detail-text text-break"
            title={candidate.education || ''}
          >
            {candidate.education || 'No indicada'}
          </span>
        </div>

        <div className="detail-item">
          <div className="detail-icon icon-teal mt-1 align-self-start">
            <i className="bi bi-translate"></i>
          </div>
          <span
            className="detail-text text-break"
            title={candidate.languages || ''}
          >
            {candidate.languages || 'No indicados'}
          </span>
        </div>

        <div className="detail-item">
          <div className="detail-icon icon-gray mt-1 align-self-start">
            <i className="bi bi-envelope"></i>
          </div>
          <span
            className="detail-text text-break"
            title={candidate.email || ''}
          >
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
