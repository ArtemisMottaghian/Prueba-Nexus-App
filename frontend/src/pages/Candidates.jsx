import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import CandidateGrid from '../components/recruitment/candidates/CandidateGrid';
import BulkActions from '../components/recruitment/shared/BulkActions';
import initialCandidatesData from '../data/candidatesData.json';
import { candidatesService } from '../services/candidatesService';

const ITEMS_POR_PAGINA = 10;

export default function Candidates() {
  const [filters, setFilters] = useState({
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
    habilidades: 'All',
    disponibilidad: 'All',
    experiencia: 'All',
    provincia: 'All',
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
      status: 'All',
      industry: 'All',
      location: 'All',
      source: 'All',
      habilidades: 'All',
      disponibilidad: 'All',
      experiencia: 'All',
      provincia: 'All',
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

  // Opciones derivadas de los datos cargados para los filtros de candidatos
  const skillsOptions = [...new Set(candidates.map((c) => c.specialty).filter(Boolean))].sort();
  const provinciaOptions = [...new Set(candidates.map((c) => c.location).filter(Boolean))].sort();

  const DISPONIBILIDAD_OPTIONS = [
    { value: 'disponible', label: 'Disponible' },
    { value: 'no_disponible', label: 'No disponible' },
  ];

  const EXPERIENCIA_OPTIONS = [
    { value: '0-2', label: '0 – 2 años' },
    { value: '3-5', label: '3 – 5 años' },
    { value: '6+', label: '6 o más años' },
  ];

  const parseExperienciaAnios = (exp) => {
    if (!exp) return 0;
    const match = String(exp).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Lógica de filtrado
  const filteredCandidates = candidates.filter((candidate) => {
    const matchEstado =
      filters.status === 'All' || candidate.status === filters.status;
    const matchEspecialidad =
      filters.industry === 'All' || candidate.specialty === filters.industry;
    const matchUbicacion =
      filters.location === 'All' || candidate.location === filters.location;
    const matchOrigen =
      filters.source === 'All' || candidate.source === filters.source;

    // Habilidades (#108)
    const matchHabilidades =
      filters.habilidades === 'All' || candidate.specialty === filters.habilidades;

    // Disponibilidad (#108)
    const matchDisponibilidad = (() => {
      if (filters.disponibilidad === 'All') return true;
      const isAvail = candidate.isAvailable ?? candidate.is_available ?? false;
      return filters.disponibilidad === 'disponible' ? isAvail : !isAvail;
    })();

    // Experiencia (#108)
    const matchExperiencia = (() => {
      if (filters.experiencia === 'All') return true;
      const anios = parseExperienciaAnios(candidate.experience);
      if (filters.experiencia === '0-2') return anios >= 0 && anios <= 2;
      if (filters.experiencia === '3-5') return anios >= 3 && anios <= 5;
      if (filters.experiencia === '6+') return anios >= 6;
      return true;
    })();

    // Provincia (#108)
    const matchProvincia =
      filters.provincia === 'All' || candidate.location === filters.provincia;

    return (
      matchEstado &&
      matchEspecialidad &&
      matchUbicacion &&
      matchOrigen &&
      matchHabilidades &&
      matchDisponibilidad &&
      matchExperiencia &&
      matchProvincia
    );
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
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        statusOptions={[
          { value: 'Nuevo', label: 'Nuevo' },
          { value: 'Contactado', label: 'Contactado' },
          { value: 'En proceso', label: 'En proceso' },
          { value: 'Descartado', label: 'Descartado' },
        ]}
        sourceOptions={[
          { value: 'LinkedIn', label: 'LinkedIn' },
          { value: 'InfoJobs', label: 'InfoJobs' },
          { value: 'Carga Manual', label: 'Carga Manual' },
          { value: 'GitHub API', label: 'GitHub API' },
        ]}
        skillsOptions={skillsOptions}
        disponibilidadOptions={DISPONIBILIDAD_OPTIONS}
        experienciaOptions={EXPERIENCIA_OPTIONS}
        provinciaOptions={provinciaOptions}
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
