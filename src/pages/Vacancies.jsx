import { useState } from 'react';
import FilterBar from '../components/recruitment/FilterBar';
import VacancyGrid from '../components/recruitment/VacancyGrid';
import BulkActions from '../components/recruitment/BulkActions';
import initialJobsData from '../data/dummyData.json';

export default function Vacancies() {
  const [filters, setFilters] = useState({
    estado: 'Todas',
    sector: 'Todos',
    ubicacion: 'Todas',
    origen: 'Todos',
  });

  const [selectedVacancies, setSelectedVacancies] = useState([]);

  const [jobs, setJobs] = useState(initialJobsData);

  const handleFilterChange = (filterName, value) => {
    setFilters((prevFilters) => ({ ...prevFilters, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      estado: 'Todas',
      sector: 'Todos',
      ubicacion: 'Todas',
      origen: 'Todos',
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

  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Directorio de Vacantes</h2>
        <p className="text-muted">
          Gestiona las oportunidades capturadas por el sistema.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {selectedVacancies.length > 0 && (
        <BulkActions
          selectedCount={selectedVacancies.length}
          onClear={() => setSelectedVacancies([])}
        />
      )}

      <VacancyGrid
        jobs={jobs}
        activeFilters={filters}
        selectedVacancies={selectedVacancies}
        onSelectVacancy={handleSelectVacancy}
        onUpdateJobStatus={handleUpdateJobStatus}
      />
    </>
  );
}
