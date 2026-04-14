import { useState } from 'react';
import VacancyCard from './VacancyCard';
import VacancyModal from './VacancyModal';
import './VacancyGrid.css';
import { vacanciesService } from '../../../services/vacanciesService';

export default function VacancyGrid({
  jobs,
  selectedVacancies,
  onSelectVacancy,
  onUpdateJobStatus,
}) {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedJob, setSelectedJob] = useState(null);

  const handleOpenModal = async (jobId) => {
    try {
      // Pedimos el detalle completo (¡con descripción!)
      const fullJobData = await vacanciesService.getVacancyById(jobId);
      // Se lo pasamos al modal
      setSelectedJob(fullJobData);
    } catch (error) {
      console.error('Error al cargar la descripción de la vacante:', error);
      alert('No se pudo cargar el detalle de la vacante.');
    } // <--- Llave del catch cerrada correctamente
  };

  return (
    <>
      <div className="results-header mb-4 mt-4">
        <h2 className="results-title">
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
          /* CAMBIO: Quitamos bg-dark-subtle y usamos nuestra clase adaptativa */
          <div className="w-100 text-center py-5 rounded-3 empty-state-container">
            <i className="bi bi-search display-4 d-block mb-3"></i>
            <p>No vacancies found with these filters.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => handleOpenModal(job.id)}
              style={{ cursor: 'pointer' }}
            >
              <VacancyCard
                job={job}
                isListView={viewMode === 'list'}
                isSelected={selectedVacancies?.includes(job.id)}
                onSelect={(e) => {
                  if (e && e.stopPropagation) e.stopPropagation();
                  onSelectVacancy(job.id);
                }}
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
