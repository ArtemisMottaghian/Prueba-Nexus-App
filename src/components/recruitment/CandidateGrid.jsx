import { useState } from 'react';
import CandidateCard from './CandidateCard';
import CandidateModal from './CandidateModal';

export default function CandidateGrid({
  candidates,
  activeFilters,
  selectedCandidates,
  onSelectCandidate,
  onUpdateCandidateStatus,
}) {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const filteredCandidates = activeFilters
    ? candidates.filter((candidate) => {
        const matchEstado =
          activeFilters.estado === 'Todos' ||
          candidate.status === activeFilters.estado;
        const matchUbicacion =
          activeFilters.ubicacion === 'Todas' ||
          candidate.location === activeFilters.ubicacion;
        const matchOrigen =
          activeFilters.origen === 'Todos' ||
          candidate.source === activeFilters.origen;
        const matchEspecialidad =
          activeFilters.especialidad === 'Todas' ||
          candidate.specialty === activeFilters.especialidad;

        return (
          matchEstado && matchEspecialidad && matchUbicacion && matchOrigen
        );
      })
    : candidates;

  return (
    <>
      <div className="results-header mb-4 mt-4">
        <h2 className="results-title">
          <span className="count-highlight">{filteredCandidates.length}</span>{' '}
          Candidatos
        </h2>

        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <i className="bi bi-grid-3x3-gap"></i>
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <i className="bi bi-list-ul"></i>
          </button>
        </div>
      </div>

      <div
        className={viewMode === 'grid' ? 'vacancies-grid' : 'vacancies-list'}
      >
        {filteredCandidates.length === 0 ? (
          <div className="w-100 text-center text-muted py-5">
            <p>No se encontraron candidatos con estos filtros.</p>
          </div>
        ) : (
          filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              onClick={() => setSelectedCandidate(candidate)}
            >
              <CandidateCard
                candidate={candidate}
                isListView={viewMode === 'list'}
                isSelected={selectedCandidates?.includes(candidate.id)}
                onSelect={onSelectCandidate}
                onUpdateStatus={onUpdateCandidateStatus}
              />
            </div>
          ))
        )}
      </div>

      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onUpdateStatus={onUpdateCandidateStatus}
        />
      )}
    </>
  );
}
