import './SmartMatchResults.css';

export default function SmartMatchResults({ job, candidates, onClose }) {
  return (
    <div className="smart-match-overlay" onClick={onClose}>
      {/* Detenemos la propagación para que al hacer clic dentro del modal no se cierre */}
      <div className="smart-match-modal" onClick={(e) => e.stopPropagation()}>
        <header className="smart-match-header">
          <div className="header-title">
            <i className="bi bi-stars"></i>
            <h3>Análisis de IA: {job.title}</h3>
          </div>
          <button className="btn-close-custom" onClick={onClose} aria-label="Cerrar">
            <i className="bi bi-x-lg"></i>
          </button>
        </header>

        <div className="smart-match-body">
          {candidates && candidates.length > 0 ? (
            <div className="candidates-match-list">
              <p className="match-subtitle">Top candidatos detectados por Nexus Engine:</p>
              {candidates.map((candidate) => (
                <div key={candidate.id} className="match-candidate-card">
                  <div className="candidate-info">
                    <span className="candidate-name">{candidate.name}</span>
                    <span className="candidate-role">{candidate.current_role || 'Candidato'}</span>
                  </div>
                  <div className="match-score">
                    <div className="score-circle">
                      <span>{candidate.match_score}%</span>
                    </div>
                  </div>
                  <button className="btn-view-profile-simple">Ver Perfil</button>
                </div>
              ))}
            </div>
          ) : (
            /* ESTADO VACÍO CLARO (Criterio #3) */
            <div className="empty-match-container">
              <div className="empty-icon-wrapper">
                <i className="bi bi-robot"></i>
              </div>
              <h4>Sin coincidencias exactas</h4>
              <p>
                El algoritmo no ha detectado candidatos en la base de datos 
                que cumplan con el 70% de los requisitos técnicos.
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