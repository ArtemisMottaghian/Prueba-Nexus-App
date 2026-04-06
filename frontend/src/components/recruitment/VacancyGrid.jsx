import { useState } from 'react';
import VacancyCard from './VacancyCard';
import VacancyModal from './VacancyModal';
import './VacancyGrid.css';

export default function VacancyGrid({
  jobs, // Ya vienen filtrados desde el padre
  selectedVacancies,
  onSelectVacancy,
  onUpdateJobStatus,
}) {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedJob, setSelectedJob] = useState(null);

  return (
    <>
      <div className="results-header mb-4 mt-4">
        <h2 className="results-title">
          {/* Usamos directamente jobs.length porque ya es la lista filtrada */}
          <span className="count-highlight">{jobs.length}</span> Vacancies
        </h2>

        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <i className="bi bi-grid-3x3-gap"></i>
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <i className="bi bi-list-ul"></i>
          </button>
        </div>
      </div>

      <div
        className={viewMode === 'grid' ? 'vacancies-grid' : 'vacancies-list'}
      >
        {jobs.length === 0 ? (
          <div className="w-100 text-center text-muted py-5 border rounded-3 bg-dark-subtle">
            <i className="bi bi-search display-4 d-block mb-3"></i>
            <p>No vacancies found with these filters.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => setSelectedJob(job)}
              style={{ cursor: 'pointer' }}
            >
              <VacancyCard
                job={job}
                isListView={viewMode === 'list'}
                isSelected={selectedVacancies?.includes(job.id)}
                onSelect={(e) => {
                  e.stopPropagation(); // Para que no se abra el modal al marcar el checkbox
                  onSelectVacancy(job.id);
                }}
                onUpdateStatus={onUpdateJobStatus}
              />
            </div>
          ))
        )}
      </div>

      {/* Modal para ver detalles de la vacante */}
      {selectedJob && (
        <VacancyModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdateStatus={onUpdateJobStatus}
        />
      )}
    </>
  );
}
