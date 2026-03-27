import { useState, useEffect } from 'react';
import FilterBar from '../components/recruitment/FilterBar';
import VacancyGrid from '../components/recruitment/VacancyGrid';
import BulkActions from '../components/recruitment/BulkActions';
import initialJobsData from '../data/dummyData.json';
import { ENDPOINTS } from '../services/api';

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

  // 2. Carga de datos
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch(ENDPOINTS.recruitment.vacantes);
        if (!response.ok) throw new Error('Server not responding');
        const data = await response.json();
        setJobs(data);
      } catch {
        console.log('Backend offline. Using updated dummyData.json...');
        setJobs(initialJobsData.vacantes || initialJobsData);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  // 3. Manejadores de eventos
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
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
  };

  // 4. Lógica de Filtrado
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
      />

      {!loading && (
        <div className="mb-3 text-muted small">
          Showing {filteredJobs.length} vacancies of {jobs.length}
        </div>
      )}

      {selectedVacancies.length > 0 && (
        <BulkActions
          selectedCount={selectedVacancies.length}
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
