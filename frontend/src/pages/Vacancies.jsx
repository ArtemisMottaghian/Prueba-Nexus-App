import { useState, useEffect } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import BulkActions from '../components/recruitment/shared/BulkActions';
import VacancyGrid from '../components/recruitment/vacancies/VacancyGrid';
import initialJobsData from '../data/dummyData.json';
import { vacanciesService } from '../services/vacanciesService';

export default function Vacancies() {
  const [filters, setFilters] = useState({
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
  });

  const [selectedVacancies, setSelectedVacancies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await vacanciesService.getAllVacancies();
        setJobs(data);
      } catch (error) {
        console.log('Backend offline o error. Usando dummyData.json...', error);
        setJobs(initialJobsData.vacantes || initialJobsData);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const handleFilterChange = (filterName, value) => {
    setFilters((prevFilters) => ({ ...prevFilters, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: 'All',
      industry: 'All',
      location: 'All',
      source: 'All',
    });
  };

  const handleSelectVacancy = (id) => {
    setSelectedVacancies((prevSelected) => {
      if (prevSelected.includes(id))
        return prevSelected.filter((vacancyId) => vacancyId !== id);
      return [...prevSelected, id];
    });
  };

  const handleUpdateJobStatus = (jobId, newStatus) => {
    // endpoint para actualizar el estado individual de una vacante.:
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
  };

  const handleBulkDiscard = async () => {
    try {
      await vacanciesService.applyBulkActions(selectedVacancies, 'discard');
      setJobs((prevJobs) =>
        prevJobs.filter((job) => !selectedVacancies.includes(job.id))
      );
      setSelectedVacancies([]);
      console.log('Vacantes descartadas con éxito');
    } catch (error) {
      console.error('Error al descartar vacantes masivamente', error);
      alert('Hubo un problema descartando las vacantes en el servidor.');
    }
  };

  // 4. Lógica de Filtrado (Local)
  const filteredJobs = jobs.filter((job) => {
    const matchStatus =
      filters.status === 'All' || job.status === filters.status;
    const matchIndustry =
      filters.industry === 'All' || job.industry === filters.industry;
    const matchLocation =
      filters.location === 'All' || job.location === filters.location;
    const matchSource =
      filters.source === 'All' || job.source === filters.source;

    return matchStatus && matchIndustry && matchLocation && matchSource;
  });

  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Vacancies Directory</h2>
        <p className="text-muted">
          Manage the job opportunities captured by the system.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        statusOptions={['Nueva', 'Contactada', 'En proceso', 'Descartada']}
        industryOptions={['Technology', 'Finance', 'Healthcare', 'Hospitality']}
      />

      {!loading && (
        <div className="mb-3 text-muted small">
          Showing {filteredJobs.length} vacancies of {jobs.length}
        </div>
      )}

      {selectedVacancies.length > 0 && (
        <BulkActions
          selectedCount={selectedVacancies.length}
          label="vacante"
          onDiscard={handleBulkDiscard}
          onClear={() => setSelectedVacancies([])}
        />
      )}

      {loading ? (
        <div className="text-center p-5 text-muted">Loading vacancies...</div>
      ) : (
        <VacancyGrid
          jobs={filteredJobs}
          activeFilters={filters}
          selectedVacancies={selectedVacancies}
          onSelectVacancy={handleSelectVacancy}
          onUpdateJobStatus={handleUpdateJobStatus}
        />
      )}
    </>
  );
}
