import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ENDPOINTS, authFetch } from '../services/api';

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

  if (loading) return <p className="p-4">Loading candidate...</p>;
  if (error) return <p className="p-4 text-danger">Error: {error}</p>;

  return (
    <div className="container py-4">
      <button className="btn btn-link ps-0 mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i>Back
      </button>

      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-1">{candidate.name}</h4>
          <p className="text-muted mb-3">{candidate.specialty}</p>

          <ul className="list-unstyled">
            {candidate.location && (
              <li>
                <i className="bi bi-geo-alt me-2"></i>
                {candidate.location}
              </li>
            )}
            {candidate.experience && (
              <li>
                <i className="bi bi-briefcase me-2"></i>
                {candidate.experience}
              </li>
            )}
            {candidate.source && (
              <li>
                <i className="bi bi-link-45deg me-2"></i>
                {candidate.source}
              </li>
            )}
            <li>
              <i
                className="bi bi-circle-fill me-2"
                style={{ fontSize: '0.5rem' }}
              ></i>
              {candidate.isAvailable ? 'Available' : 'Not available'}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
