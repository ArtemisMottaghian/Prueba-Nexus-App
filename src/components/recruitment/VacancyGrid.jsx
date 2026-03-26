import { useState } from 'react';
import VacancyCard from './VacancyCard';
import VacancyModal from './VacancyModal';
import jobsData from '../../data/dummyData.json';

export default function VacancyGrid() {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedJob, setSelectedJob] = useState(null);

  return (
    <>
      <div className="results-header mb-4 mt-4">
        <h2 className="results-title">
          <span className="count-highlight">{jobsData.length}</span> Vacantes
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
        {jobsData.map((job) => (
          <div key={job.id} onClick={() => setSelectedJob(job)}>
            <VacancyCard job={job} isListView={viewMode === 'list'} />
          </div>
        ))}
      </div>

      {/* 4. Dibujamos el modal. Si "selectedJob" tiene algo, se abre. */}
      {selectedJob && (
        <VacancyModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
        />
      )}
    </>
  );
}