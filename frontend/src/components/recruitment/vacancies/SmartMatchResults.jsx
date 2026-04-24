import './SmartMatchResults.css';

export default function SmartMatchResults({ job, candidates, onClose }) {
  
  // Cerramos el modal si el usuario hace clic en el fondo (overlay)
  const handleOverlayClick = (e) => {
    if (e.target.className === 'smart-match-overlay') {
      onClose();
    }
  };

  return (
    <div className="smart-match-overlay" onClick={handleOverlayClick}>
      {/* stopPropagation evita que al hacer clic dentro del modal se cierre */}
      <div className="smart-match-modal" onClick={(e) => e.stopPropagation()}>
        <header className="smart-match-header">
          <div className="header-title">
            <i className="bi bi-stars"></i>
            <h3>Análisis de IA: {job.title}</h3>
          </div>
          <button 
            className="btn-close-custom" 
            onClick={onClose} 
            aria-label="Cerrar"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </header>

        <div className="smart-match-body">
          {candidates && candidates.length > 0 ? (
            <div className="candidates-match-list">
              <p className="match-subtitle">
                Nexus Engine ha detectado {candidates.length} perfiles compatibles:
              </p>
              
              {candidates.map((candidate) => (
                <div key={candidate.id} className="match-candidate-card">
                  <div className="candidate-info">
                    <span className="candidate-name">
                      {candidate.name}
                      {candidate.verified && (
                        <i className="bi bi-patch-check-fill text-info ms-2" title="Verificado"></i>
                      )}
                    </span>
                    <span className="candidate-role">
                      {candidate.speciality || 'Especialista'} 
                    </span>
                    <span className="candidate-location small text-muted">
                      <i className="bi bi-geo-alt me-1"></i>
                      {candidate.location}
                    </span>
                  </div>

                  <div className="match-score-wrapper">
                    <div className="score-circle">
                      <span className="score-value">{candidate.match_score}%</span>
                    </div>
                    <span className="score-label">Match</span>
                  </div>

                  <div className="candidate-actions">
                    <button 
                      className="btn-view-profile-simple"
                      onClick={() => window.open(`/candidates/${candidate.id}`, '_blank')}
                    >
                      Ver Perfil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ESTADO VACÍO (Criterio #3 del ticket) */
            <div className="empty-match-container">
              <div className="empty-icon-wrapper">
                <i className="bi bi-robot"></i>
              </div>
              <h4>Sin coincidencias de IA</h4>
              <p>
                El algoritmo no ha encontrado candidatos que superen el umbral 
                crítico de compatibilidad para los requisitos de esta vacante.
              </p>
              <button className="btn-simple-nexus" onClick={onClose}>
                Entendido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}