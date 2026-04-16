import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import CandidateGrid from '../components/recruitment/candidates/CandidateGrid';
import BulkActions from '../components/recruitment/shared/BulkActions';
import initialCandidatesData from '../data/candidatesData.json';
import { candidatesService } from '../services/candidatesService';

const ITEMS_POR_PAGINA = 10;

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

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);

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

  const handleToggleFavorite = async (candidateId, currentIsFavorite) => {
    const newFavoriteStatus = !currentIsFavorite;
    setCandidates((prevCandidates) =>
      prevCandidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, isFavorite: newFavoriteStatus }
          : candidate
      )
    );

    try {
      await candidatesService.toggleFavorite(candidateId, newFavoriteStatus);
    } catch (error) {
      console.error('Error al actualizar favorito en el servidor', error);
      setCandidates((prevCandidates) =>
        prevCandidates.map((candidate) =>
          candidate.id === candidateId
            ? { ...candidate, isFavorite: currentIsFavorite }
            : candidate
        )
      );
    }
  };

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

  // Reset página al cambiar filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filters]);

  // Cálculo de paginación
  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredCandidates.length / ITEMS_POR_PAGINA)
  );
  const paginaSafe = Math.min(paginaActual, totalPaginas);

  const candidatesPaginados = useMemo(() => {
    const inicio = (paginaSafe - 1) * ITEMS_POR_PAGINA;
    return filteredCandidates.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [filteredCandidates, paginaSafe]);

  const irAPagina = (p) =>
    setPaginaActual(Math.max(1, Math.min(p, totalPaginas)));

  // Páginas visibles (máx 3 centradas en la actual)
  const paginasVisibles = useMemo(() => {
    let inicio = Math.max(1, paginaSafe - 1);
    let fin = Math.min(totalPaginas, inicio + 2);
    if (fin - inicio < 2) inicio = Math.max(1, fin - 2);
    const pages = [];
    for (let i = inicio; i <= fin; i++) pages.push(i);
    return pages;
  }, [paginaSafe, totalPaginas]);

  const desde =
    filteredCandidates.length === 0
      ? 0
      : (paginaSafe - 1) * ITEMS_POR_PAGINA + 1;
  const hasta = Math.min(
    paginaSafe * ITEMS_POR_PAGINA,
    filteredCandidates.length
  );

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
          candidates={candidatesPaginados}
          activeFilters={null}
          selectedCandidates={selectedCandidates}
          onSelectCandidate={handleSelectCandidate}
          onUpdateCandidateStatus={handleUpdateCandidateStatus}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Paginación */}
      {!loading && totalPaginas > 1 && (
        <div className="clientes-pagination" style={{ marginTop: '1rem' }}>
          <span className="clientes-pagination__info">
            {desde}–{hasta} de {filteredCandidates.length}
          </span>
          <div className="clientes-pagination__controls">
            <button
              className="clientes-pagination__btn"
              onClick={() => irAPagina(paginaSafe - 1)}
              disabled={paginaSafe === 1}
              aria-label="Página anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            {paginasVisibles[0] > 1 && (
              <>
                <button
                  className="clientes-pagination__btn"
                  onClick={() => irAPagina(1)}
                >
                  1
                </button>
                {paginasVisibles[0] > 2 && (
                  <span className="clientes-pagination__dots">…</span>
                )}
              </>
            )}

            {paginasVisibles.map((p) => (
              <button
                key={p}
                className={`clientes-pagination__btn ${p === paginaSafe ? 'active' : ''}`}
                onClick={() => irAPagina(p)}
              >
                {p}
              </button>
            ))}

            {paginasVisibles[paginasVisibles.length - 1] < totalPaginas && (
              <>
                {paginasVisibles[paginasVisibles.length - 1] <
                  totalPaginas - 1 && (
                  <span className="clientes-pagination__dots">…</span>
                )}
                <button
                  className="clientes-pagination__btn"
                  onClick={() => irAPagina(totalPaginas)}
                >
                  {totalPaginas}
                </button>
              </>
            )}

            <button
              className="clientes-pagination__btn"
              onClick={() => irAPagina(paginaSafe + 1)}
              disabled={paginaSafe === totalPaginas}
              aria-label="Página siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
