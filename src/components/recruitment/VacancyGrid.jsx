import { useState } from 'react';
import VacancyCard from './VacancyCard';
import VacancyModal from './VacancyModal';

// 2. Recibimos 'jobs' y 'onUpdateJobStatus' del padre
export default function VacancyGrid({ jobs, activeFilters, selectedVacancies, onSelectVacancy, onUpdateJobStatus }) {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedJob, setSelectedJob] = useState(null);

  const filteredJobs = activeFilters ? jobs.filter((job) => {
    const matchEstado = activeFilters.estado === 'Todas' || job.status === activeFilters.estado;
    const matchUbicacion = activeFilters.ubicacion === 'Todas' || job.location === activeFilters.ubicacion;
    const matchOrigen = activeFilters.origen === 'Todos' || job.source === activeFilters.origen;
    const matchSector = activeFilters.sector === 'Todos' || job.sector === activeFilters.sector;

    return matchEstado && matchSector && matchUbicacion && matchOrigen;
  }) : jobs;

  return (
    <>
      <div className="results-header mb-4 mt-4">
        <h2 className="results-title">
          <span className="count-highlight">{filteredJobs.length}</span> Vacantes
        </h2>

        <div className="view-toggle">
          <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
            <i className="bi bi-grid-3x3-gap"></i>
          </button>
          <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
            <i className="bi bi-list-ul"></i>
          </button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'vacancies-grid' : 'vacancies-list'}>
        {filteredJobs.length === 0 ? (
          <div className="w-100 text-center text-muted py-5">
            <p>No se encontraron vacantes con estos filtros.</p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div key={job.id} onClick={() => setSelectedJob(job)}>
              <VacancyCard 
                job={job}  
                isListView={viewMode === 'list'}  
                isSelected={selectedVacancies?.includes(job.id)}
                onSelect={onSelectVacancy} 
                onUpdateStatus={onUpdateJobStatus} 
              />
            </div>
          ))
        )}
      </div>

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