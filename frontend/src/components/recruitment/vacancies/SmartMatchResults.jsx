import { useState } from 'react';
import { ENDPOINTS, authFetch } from '../../../services/api';
import './SmartMatchResults.css';

export default function SmartMatchResults({ job, candidates, onClose }) {
  const [addedCandidates, setAddedCandidates] = useState({});

  const handleAddToTracking = async (candidate) => {
    try {
      await authFetch(ENDPOINTS.recruitment.vacantes.applications(job.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidate.id }),
      });
      setAddedCandidates((prev) => ({ ...prev, [candidate.id]: true }));
    } catch (err) {
      console.error('Error añadiendo candidato al seguimiento:', err);
    }
  };
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
                Nexus Engine ha detectado {candidates.length} perfiles
                compatibles:
              </p>

              {candidates.map((candidate) => (
                <div key={candidate.id} className="match-candidate-card">
                  <div className="match-candidate-header">
                    <div className="candidate-info">
                      <span className="candidate-name">
                        {candidate.nombre}
                        {candidate.verified && (
                          <i
                            className="bi bi-patch-check-fill text-info ms-2"
                            title="Verificado"
                          ></i>
                        )}
                      </span>
                      <span className="candidate-role">
                        {candidate.speciality || 'Especialista'}
                      </span>
                      {candidate.location && (
                        <span className="candidate-location small text-muted">
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
                        window.open(`/candidates/${candidate.id}`, '_blank')
                      }
                    >
                      <i className="bi bi-person-badge me-2"></i>
                      Ver Perfil
                    </button>
                    <button
                      className={`btn-view-profile-simple ${addedCandidates[candidate.id] ? 'btn-added' : ''}`}
                      onClick={() => handleAddToTracking(candidate)}
                      disabled={addedCandidates[candidate.id]}
                    >
                      {addedCandidates[candidate.id] ? (
                        <>
                          <i className="bi bi-check-circle-fill me-2"></i>
                          Añadido
                        </>
                      ) : (
                        <>
                          <i className="bi bi-person-plus me-2"></i>Añadir a
                          seguimiento
                        </>
                      )}
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
                El motor de Nexus aún no ha encontrado candidatos compatibles
                con esta vacante. Prueba a ampliar los requisitos o espera a que
                haya más perfiles disponibles en la base de datos.
              </p>
              <button className="btn-simple-nexus" onClick={onClose}>
                <i className="bi bi-arrow-repeat me-2"></i>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
