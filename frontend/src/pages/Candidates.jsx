import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import CandidateGrid from '../components/recruitment/candidates/CandidateGrid';
import BulkActions from '../components/recruitment/shared/BulkActions';
import initialCandidatesData from '../data/candidatesData.json';
import { candidatesService } from '../services/candidatesService';
import { CANDIDATE_STATUS_OPTIONS } from '../constants/candidateStatus';

const ITEMS_POR_PAGINA = 10;

function filtersToApiQuery(f) {
  const q = {};
  if (f.verified === 'yes') q.verified = true;
  if (f.verified === 'no') q.verified = false;
  if (f.location && f.location !== 'All') q.location = f.location;
  if (f.habilidades && f.habilidades !== 'All') q.skills = f.habilidades;
  if (f.status && f.status !== 'All') q.status = f.status;
  if (f.source && f.source !== 'All') q.source = f.source;
  return q;
}

export default function Candidates() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
    habilidades: 'All',
    disponibilidad: 'All',
    experiencia: 'All',
    verified: 'All',
  });

  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationOptions, setLocationOptions] = useState([]);

  const [paginaActual, setPaginaActual] = useState(1);

  // NUEVOS ESTADOS: Para los botones de favoritos y descartados
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDescartadas, setShowDescartadas] = useState(false);

  const apiListQuery = useMemo(
    () =>
      filtersToApiQuery({
        location: filters.location,
        habilidades: filters.habilidades,
        status: filters.status,
        source: filters.source,
        verified: filters.verified,
      }),
    [
      filters.location,
      filters.habilidades,
      filters.status,
      filters.source,
      filters.verified,
    ]
  );

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locs = await candidatesService.getLocations();
        setLocationOptions(locs);
      } catch (error) {
        console.error('Error al cargar las ubicaciones normalizadas:', error);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await candidatesService.getAllCandidates(apiListQuery);
        if (!cancelled) setCandidates(data);
      } catch {
        if (!cancelled) {
          console.log('Backend offline. Using candidatesData.json...');
          setCandidates(initialCandidatesData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiListQuery]);

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

  const handleFilterChange = (filterName, value) => {
    setFilters((prevFilters) => ({ ...prevFilters, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'All',
      industry: 'All',
      location: 'All',
      source: 'All',
      habilidades: 'All',
      disponibilidad: 'All',
      experiencia: 'All',
      verified: 'All',
    });
    setShowFavoritesOnly(false);
    setShowDescartadas(false);
  };

  const handleVerify = async (candidateId) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, verified: true } : c))
    );
    try {
      await candidatesService.verifyCandidate(candidateId, true);
    } catch (e) {
      console.error('No se pudo verificar el candidato', e);
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, verified: false } : c))
      );
    }
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

  const skillsOptions = [
    ...new Set(candidates.map((c) => c.specialty).filter(Boolean)),
  ].sort();

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

  // --- LÓGICA DE FILTRADO PRINCIPAL ---
  const filteredCandidates = candidates.filter((candidate) => {
    // 1. Filtro de Descartados (Oculta por defecto los descartados a menos que se pulse el botón)
    const safeStatus = (candidate.status || '').toLowerCase().trim();
    const arrDiscard = ['descartada', 'discarded', 'rejected', 'descartado'];
    if (filters.status === 'All') {
      if (!showDescartadas && arrDiscard.includes(safeStatus)) return false;
    }

    // 2. Filtro de Favoritos
    if (showFavoritesOnly && !candidate.isFavorite) return false;

    // 3. Resto de filtros...
    const term = (filters.search || '').trim().toLowerCase();
    const matchSearch =
      !term ||
      candidate.name?.toLowerCase().includes(term) ||
      (candidate.email && candidate.email.toLowerCase().includes(term)) ||
      String(candidate.specialty || '')
        .toLowerCase()
        .includes(term);

    const matchEspecialidad =
      filters.industry === 'All' || candidate.specialty === filters.industry;

    const matchDisponibilidad = (() => {
      if (filters.disponibilidad === 'All') return true;
      const isAvail = candidate.isAvailable ?? candidate.is_available ?? false;
      return filters.disponibilidad === 'disponible' ? isAvail : !isAvail;
    })();

    const matchExperiencia = (() => {
      if (filters.experiencia === 'All') return true;
      const anios = parseExperienciaAnios(candidate.experience);
      if (filters.experiencia === '0-2') return anios >= 0 && anios <= 2;
      if (filters.experiencia === '3-5') return anios >= 3 && anios <= 5;
      if (filters.experiencia === '6+') return anios >= 6;
      return true;
    })();

    return (
      matchSearch &&
      matchEspecialidad &&
      matchDisponibilidad &&
      matchExperiencia
    );
  });

  // Reset página al cambiar filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filters, showFavoritesOnly, showDescartadas]);

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
      <div className="controls-container sticky-controls">
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          statusOptions={CANDIDATE_STATUS_OPTIONS}
          sourceOptions={[
            { value: 'LinkedIn', label: 'LinkedIn' },
            { value: 'InfoJobs', label: 'InfoJobs' },
            { value: 'Carga Manual', label: 'Carga Manual' },
            { value: 'GitHub API', label: 'GitHub API' },
          ]}
          locationOptions={locationOptions}
          skillsOptions={skillsOptions}
          disponibilidadOptions={DISPONIBILIDAD_OPTIONS}
          experienciaOptions={EXPERIENCIA_OPTIONS}
          showVerifiedFilter
        />

        {selectedCandidates.length > 0 && (
          <div className="bulk-actions-wrapper animate__animated animate__fadeInDown animate__faster">
            <BulkActions
              selectedCount={selectedCandidates.length}
              onClear={() => setSelectedCandidates([])}
            />
          </div>
        )}
      </div>

      {!loading && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted small">
            Mostrando {filteredCandidates.length} candidatos de{' '}
            {candidates.length}
          </div>

          <div className="d-flex gap-2">
            <button
              className={`btn btn-sm ${showDescartadas ? 'btn-danger' : 'btn-outline-secondary'}`}
              onClick={() => {
                setShowDescartadas(!showDescartadas);
                setShowFavoritesOnly(false);
              }}
              title="Los candidatos descartados están ocultos por defecto"
            >
              <i
                className={`bi ${showDescartadas ? 'bi-eye-fill' : 'bi-eye-slash'} me-2`}
              ></i>
              {showDescartadas ? 'Ocultando activos' : 'Ver descartados'}
            </button>
            <button
              className={`btn btn-sm ${showFavoritesOnly ? 'btn-warning' : 'btn-outline-secondary'}`}
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setShowDescartadas(false);
              }}
            >
              <i
                className={`bi ${showFavoritesOnly ? 'bi-star-fill' : 'bi-star'} me-2`}
              ></i>
              Solo Favoritos
            </button>
          </div>
        </div>
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
          onVerify={handleVerify}
        />
      )}
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
