import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ENDPOINTS, authFetch } from '../services/api';
import '../components/recruitment/candidates/CandidateDetail.css';

export default function CandidateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    authFetch(ENDPOINTS.recruitment.candidatos.detail(id))
      .then((res) => {
        if (!res.ok) throw new Error('Candidate not found');
        return res.json();
      })
      .then((data) => setCandidate(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="cd-shell">
        <div className="cd-loading">
          <div className="cd-spinner"></div>
          <span>Loading candidate...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cd-shell">
        <div className="cd-error">
          <i className="bi bi-exclamation-triangle cd-error-icon"></i>
          <h2>Candidate not found</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const avatarLetter = candidate.name?.charAt(0).toUpperCase() || '?';

  return (
    <div className="cd-shell">
      {/* ── HERO ── */}
      <div className="cd-hero">
        <div className="cd-container">
          <button className="cd-back-btn" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left"></i>Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <div className="cd-candidate-avatar">{avatarLetter}</div>

            <div className="cd-hero-info">
              <h1 className="cd-name">{candidate.name}</h1>
              <p className="cd-specialty">{candidate.specialty || 'Specialist'}</p>

              <div className="cd-meta-row">
                {candidate.location && (
                  <span className="cd-meta-chip">
                    <i className="bi bi-geo-alt"></i>
                    {candidate.location}
                  </span>
                )}
                {candidate.experience && (
                  <span className="cd-meta-chip">
                    <i className="bi bi-briefcase"></i>
                    {candidate.experience}
                  </span>
                )}
                {candidate.source && (
                  <span className="cd-meta-chip cd-meta-chip--source">
                    <i className="bi bi-link-45deg"></i>
                    {candidate.source}
                  </span>
                )}
                <span
                  className={`cd-meta-chip ${
                    candidate.isAvailable
                      ? 'cd-meta-chip--available'
                      : 'cd-meta-chip--unavailable'
                  }`}
                >
                  <i
                    className={`bi ${
                      candidate.isAvailable
                        ? 'bi-check-circle'
                        : 'bi-x-circle'
                    }`}
                  ></i>
                  {candidate.isAvailable ? 'Available' : 'Not available'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="cd-body">
        <div className="cd-container">
          <div className="cd-body-layout">

            {/* Columna principal */}
            <div className="cd-card">
              <h2 className="cd-section-title">Candidate information</h2>

              {candidate.experience && (
                <div className="cd-field-block">
                  <p className="cd-field-label">Experience</p>
                  <p className="cd-field-value">{candidate.experience}</p>
                </div>
              )}

              {candidate.status && (
                <div className="cd-field-block">
                  <p className="cd-field-label">Status</p>
                  <p className="cd-field-value">{candidate.status}</p>
                </div>
              )}

              {candidate.time && (
                <div className="cd-field-block">
                  <p className="cd-field-label">Time</p>
                  <p className="cd-field-value">{candidate.time}</p>
                </div>
              )}

              {!candidate.experience && !candidate.status && !candidate.time && (
                <p className="cd-no-data">No additional information available.</p>
              )}
            </div>

            {/* Columna lateral */}
            <div className="cd-side-col">
              <div className="cd-card cd-info-card">
                <h2 className="cd-section-title">Details</h2>
                <ul className="cd-info-list">
                  {candidate.location && (
                    <li>
                      <div className="cd-info-icon">
                        <i className="bi bi-geo-alt"></i>
                      </div>
                      <div>
                        <p className="cd-info-label">Location</p>
                        <p className="cd-info-value">{candidate.location}</p>
                      </div>
                    </li>
                  )}
                  {candidate.source && (
                    <li>
                      <div className="cd-info-icon">
                        <i className="bi bi-link-45deg"></i>
                      </div>
                      <div>
                        <p className="cd-info-label">Source</p>
                        <p className="cd-info-value">{candidate.source}</p>
                      </div>
                    </li>
                  )}
                  <li>
                    <div className="cd-info-icon">
                      <i className="bi bi-person-check"></i>
                    </div>
                    <div>
                      <p className="cd-info-label">Availability</p>
                      <span
                        className={`cd-status-badge ${
                          candidate.isAvailable
                            ? 'cd-status-badge--available'
                            : 'cd-status-badge--unavailable'
                        }`}
                      >
                        <i
                          className={`bi ${
                            candidate.isAvailable
                              ? 'bi-check-circle-fill'
                              : 'bi-x-circle-fill'
                          }`}
                        ></i>
                        {candidate.isAvailable ? 'Available' : 'Not available'}
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}