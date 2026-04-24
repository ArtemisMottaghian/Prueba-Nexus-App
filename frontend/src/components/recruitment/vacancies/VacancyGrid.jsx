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
}) {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Estados para el Smart Match (#330)
  const [matchingJob, setMatchingJob] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [activeMatchingId, setActiveMatchingId] = useState(null);

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

  // --- LÓGICA SMART MATCH CONEXIÓN BACKEND ---
  const handleSmartMatch = async (e, job) => {
    if (e && e.stopPropagation) e.stopPropagation();
    
    setIsMatching(true);
    setActiveMatchingId(job.id); // Para que solo brille el botón de esta tarjeta

    try {
      // Esta es la llamada a la API que tu compañero ha subido
      const results = await vacanciesService.getSmartMatch(job.id);
      
      // Si la API responde correctamente, seteamos el job con sus candidatos
      setMatchingJob({ 
        ...job, 
        candidates: results || [] 
      });
    } catch (error) {
      console.error('Error en el algoritmo de matching:', error);
      // Criterio de aceptación: Mostrar estado vacío si hay error o no hay matches
      setMatchingJob({ 
        ...job, 
        candidates: [] 
      });
    } finally {
      setIsMatching(false);
      setActiveMatchingId(null);
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
            title="Vista cuadrícula"
          >
            <i className="bi bi-grid-3x3-gap"></i>
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Vista lista"
          >
            <i className="bi bi-list-ul"></i>
          </button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'vacancies-grid' : 'vacancies-list'}>
        {jobs.length === 0 ? (
          <div className="empty-state-container">
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
                // Solo activamos el loading para la tarjeta que se está procesando
                isMatching={isMatching && activeMatchingId === job.id}
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