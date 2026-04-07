import { useState, useEffect } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import CandidateGrid from '../components/recruitment/candidates/CandidateGrid';
import BulkActions from '../components/recruitment/shared/BulkActions';
import initialCandidatesData from '../data/candidatesData.json';
import { candidatesService } from '../services/candidatesService';

export default function Candidates() {
  const [filters, setFilters] = useState({
    estado: 'Todos',
    especialidad: 'Todas',
    ubicacion: 'Todas',
    origen: 'Todos',
  });

  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial de datos
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const data = await candidatesService.getAllCandidates();
        setCandidates(data);
      } catch {
        console.log('Backend offline. Using candidatesData.json...');
        setCandidates(initialCandidatesData);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  // Manejadores de eventos
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

  const handleSelectCandidate = (id) => {
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

  // Lógica de filtrado
  const filteredCandidates = candidates.filter((candidate) => {
    const matchEstado =
      filters.estado === 'Todos' || candidate.status === filters.estado;
    const matchEspecialidad =
      filters.especialidad === 'Todas' ||
      candidate.specialty === filters.especialidad;
    const matchUbicacion =
      filters.ubicacion === 'Todas' || candidate.location === filters.ubicacion;
    const matchOrigen =
      filters.origen === 'Todos' || candidate.source === filters.origen;

    return matchEstado && matchEspecialidad && matchUbicacion && matchOrigen;
  });
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

      {!loading && (
        <div className="mb-3 text-muted small">
          Mostrando {filteredCandidates.length} candidatos de{' '}
          {candidates.length}
        </div>
      )}

      {selectedCandidates.length > 0 && (
        <BulkActions
          selectedCount={selectedCandidates.length}
          onClear={() => setSelectedCandidates([])}
        />
      )}

      {loading ? (
        <div className="text-center p-5 text-muted">Cargando candidatos...</div>
      ) : (
        <CandidateGrid
          candidates={filteredCandidates}
          activeFilters={filters}
          selectedCandidates={selectedCandidates}
          onSelectCandidate={handleSelectCandidate}
          onUpdateCandidateStatus={handleUpdateCandidateStatus}
        />
      )}
    </>
  );
}
