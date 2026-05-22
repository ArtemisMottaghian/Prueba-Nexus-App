import './SmartMatchResults.css';
export default function SmartMatchResults({ job, candidates, onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target.className === 'smart-match-overlay') {
      onClose();
    }
  };
  return (
    <div className="smart-match-overlay" onClick={handleOverlayClick}>
      <div className="smart-match-modal" onClick={(e) => e.stopPropagation()}>
        <header className="smart-match-header">
          <div className="header-title">
            <i className="bi bi-stars"></i>
            <h3>Análisis de IA: {job.title}</h3>
          </div>
          <button className="btn-close-custom" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </header>
        <div className="smart-match-body">
          {candidates && candidates.length > 0 ? (
            <div className="candidates-match-list">
              <p className="match-subtitle">
                Nexus Engine ha detectado {candidates.length} perfiles
                compatibles:
              </p>
              {candidates.map((candidate) => (
                <div key={candidate.id} className="match-candidate-card">
                  <div className="match-candidate-header">
                    <div className="candidate-info">
                      <span className="candidate-name">{candidate.nombre}</span>
                      {candidate.location && (
                        <span className="candidate-location small text-muted d-block mt-1">
                          <i className="bi bi-geo-alt me-1"></i>
                          {candidate.location}
                        </span>
                      )}
                    </div>
                    <div className="match-score-wrapper">
                      <div className="score-header">
                        <span className="score-label">Afinidad</span>
                        <span className="score-value">{candidate.score}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${candidate.score}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  {candidate.reasoning && (
                    <div className="ai-explanation-card">
                      <div className="ai-explanation-header">
                        <i className="bi bi-magic ai-icon"></i>
                        <span>Motivo de compatibilidad (IA)</span>
                      </div>
                      <p className="ai-explanation-text">
                        {candidate.reasoning}
                      </p>
                    </div>
                  )}
                  <div className="candidate-actions">
                    <button
                      className="btn-view-profile-simple"
                      onClick={() =>
                        window.open(`/candidatos/${candidate.id}`, '_blank')
                      }
                    >
                      <i className="bi bi-person-badge me-2"></i>Ver Perfil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-match-container">
              <div className="empty-icon-wrapper">
                <i className="bi bi-robot"></i>
              </div>
              <h4>Sin coincidencias por ahora</h4>
              <p>
                El motor de Nexus aún no ha encontrado candidatos compatibles.
              </p>
              <button className="btn-simple-nexus" onClick={onClose}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
