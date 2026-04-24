import { useState } from 'react';
import VacancyCard from './VacancyCard';
import VacancyModal from './VacancyModal';
import SmartMatchResults from "./SmartMatchResults"; 
import './VacancyGrid.css';
import { vacanciesService } from '../../../services/vacanciesService';

export default function VacancyGrid({
  jobs,
  selectedVacancies,
  onSelectVacancy,
  onUpdateJobStatus,
  onToggleFavorite,
  onAsignarVacante,
  currentUser,
  isNegocio,
  emptyStateReclutador,
}) {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Estados para el Smart Match (#330)
  const [matchingJob, setMatchingJob] = useState(null);
  const [isMatching, setIsMatching] = useState(false);

  // Abrir modal de detalles normal
  const handleOpenModal = async (jobId) => {
    try {
      const fullJobData = await vacanciesService.getVacancyById(jobId);
      setSelectedJob(fullJobData);
    } catch (error) {
      console.error('Error al cargar detalle:', error);
      const fallbackJob = jobs.find((j) => j.id === jobId);
      if (fallbackJob) setSelectedJob(fallbackJob);
    }
  };

  // Activar Algoritmo de IA (#330)
  const handleSmartMatch = async (e, job) => {
    e.stopPropagation(); // Evita abrir el modal normal
    setIsMatching(true);
    try {
      // Llamada al servicio que conecta con el backend
      const results = await vacanciesService.getSmartMatch(job.id);
      setMatchingJob({ ...job, candidates: results });
    } catch (error) {
      console.error('Error en Smart Match:', error);
      // Criterio de aceptación: Si falla o no hay, mostramos estado vacío
      setMatchingJob({ ...job, candidates: [] });
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="vacancy-grid-wrapper">
      <div className="results-header mb-4 mt-4">
        <h2 className="results-title">
          <span className="count-highlight">{jobs.length}</span> Vacantes
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

      <div className={viewMode === 'grid' ? 'vacancies-grid' : 'vacancies-list'}>
        {jobs.length === 0 ? (
          /* CAMBIO: Quitamos bg-dark-subtle y usamos nuestra clase adaptativa */
          <div className="w-100 text-center py-5 rounded-3 empty-state-container">
            <i className="bi bi-search display-4 d-block mb-3"></i>
            <p>No se encontraron vacantes con estos filtros.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => handleOpenModal(job.id)}
              className="vacancy-card-wrapper"
            >
              <VacancyCard
                job={job}
                isListView={viewMode === 'list'}
                isSelected={selectedVacancies?.includes(job.id)}
                onSelect={(e) => onSelectVacancy(job.id)}
                onUpdateStatus={onUpdateJobStatus}
                onToggleFavorite={onToggleFavorite}
                onSmartMatch={(e) => handleSmartMatch(e, job)}
                isMatching={isMatching && matchingJob?.id === job.id}
              />
            </div>
          ))
        )}
      </div>

      {/* Modal Detalles Normal */}
      {selectedJob && (
        <VacancyModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdateStatus={onUpdateJobStatus}
          onToggleFavorite={onToggleFavorite}
          onAsignarVacante={onAsignarVacante}
          currentUser={currentUser}
          isNegocio={isNegocio}
        />
      )}

      {/* Modal Resultados IA (#330) */}
      {matchingJob && (
        <SmartMatchResults
          job={matchingJob}
          candidates={matchingJob.candidates}
          onClose={() => setMatchingJob(null)}
        />
      )}
    </div>
  );
}