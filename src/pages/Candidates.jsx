import { useState } from 'react';
import FilterBar from '../components/recruitment/FilterBar';
import CandidateGrid from '../components/recruitment/CandidateGrid';
import BulkActions from '../components/recruitment/BulkActions';
import initialJobsData from '../data/dummyData.json';

export default function Candidates() {
  const [filters, setFilters] = useState({
    estado: 'Todos',
    especialidad: 'Todas',
    ubicacion: 'Todas',
    origen: 'Todos',
  });

  const [selectedCandidates, setSelectedCandidates] = useState([]);

  const [candidates, setCandidates] = useState(initialCandidatesData);

  const handleFilterChange = (filterName, value) => {
    setFilters((prevFilters) => ({ ...prevFilters, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      estado: 'Todos',
      especialidad: 'Todas',
      ubicacion: 'Todas',
      origen: 'Todos',
    });
  };

  const handleSelectCandidates = (id) => {
    setSelectedCandidates((prevSelected) => {
      if (prevSelected.includes(id))
        return prevSelected.filter((vacancyId) => vacancyId !== id);
      return [...prevSelected, id];
    });
  };

  const handleUpdateCandidateStatus = (candidateId, newStatus) => {
    setCandidates((prevCandidates) =>
      prevCandidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, status: newStatus }
          : candidate
      )
    );
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Directorio de Candidatos</h2>
        <p className="text-muted">
          Gestiona los perfiles captados por el sistema.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {selectedCandidates.length > 0 && (
        <BulkActions
          selectedCount={selectedCandidates.length}
          onClear={() => setSelectedCandidates([])}
        />
      )}

      <CandidateGrid
        candidates={candidates}
        activeFilters={filters}
        selectedCandidates={selectedCandidates}
        onSelectCandidate={handleSelectCandidate}
        onUpdateCandidateStatus={handleUpdateCandidateStatus}
      />
    </>
  );
}
