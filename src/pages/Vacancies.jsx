import { useState } from 'react';
import FilterBar from '../components/recruitment/FilterBar';
import VacancyGrid from '../components/recruitment/VacancyGrid';
import BulkActions from '../components/recruitment/BulkActions';
// 1. IMPORTANTE: Ahora importamos los datos aquí, en el jefe
import initialJobsData from '../data/dummyData.json'; 

export default function Vacancies() {
  const [filters, setFilters] = useState({
    estado: 'Todas',
    sector: 'Todos',
    ubicacion: 'Todas',
    origen: 'Todos'
  });

  const [selectedVacancies, setSelectedVacancies] = useState([]);
  
  // 2. NUEVA MEMORIA: Guardamos los trabajos aquí para poder modificarlos
  const [jobs, setJobs] = useState(initialJobsData);

  const handleFilterChange = (filterName, value) => {
    setFilters(prevFilters => ({ ...prevFilters, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ estado: 'Todas', sector: 'Todos', ubicacion: 'Todas', origen: 'Todos' });
  };

  const handleSelectVacancy = (id) => {
    setSelectedVacancies(prevSelected => {
      if (prevSelected.includes(id)) return prevSelected.filter(vacancyId => vacancyId !== id);
      return [...prevSelected, id];
    });
  };

  // 3. NUEVA FUNCIÓN: Busca la vacante por ID y le cambia el estado
  const handleUpdateJobStatus = (jobId, newStatus) => {
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Directorio de Vacantes</h2>
        <p className="text-muted">Gestiona las oportunidades capturadas por el sistema.</p>
      </div>
      
      <FilterBar filters={filters} onFilterChange={handleFilterChange} onClearFilters={handleClearFilters} />

      {selectedVacancies.length > 0 && (
        <BulkActions selectedCount={selectedVacancies.length} onClear={() => setSelectedVacancies([])} />
      )}
      
      <VacancyGrid 
        jobs={jobs} // 4. Le pasamos los trabajos al hijo
        activeFilters={filters} 
        selectedVacancies={selectedVacancies} 
        onSelectVacancy={handleSelectVacancy}
        onUpdateJobStatus={handleUpdateJobStatus} // 5. Le pasamos la función para actualizar
      />
    </>
  );
}