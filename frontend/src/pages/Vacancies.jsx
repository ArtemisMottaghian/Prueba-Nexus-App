import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import BulkActions from '../components/recruitment/shared/BulkActions';
import VacancyGrid from '../components/recruitment/vacancies/VacancyGrid';
import initialJobsData from '../data/dummyData.json';
import { vacanciesService } from '../services/vacanciesService';
import { useSearchParams } from 'react-router-dom';

const ITEMS_POR_PAGINA = 10;

export default function Vacancies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryURL = searchParams.get('q') || '';
  const [filters, setFilters] = useState({
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
  });

  const [selectedVacancies, setSelectedVacancies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);

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
    setShowFavoritesOnly(false);

    if (searchParams.has('q')) {
      searchParams.delete('q');
      setSearchParams(searchParams);
    }
  };

  const handleSelectVacancy = (id) => {
    setSelectedVacancies((prevSelected) => {
      if (prevSelected.includes(id))
        return prevSelected.filter((vacancyId) => vacancyId !== id);
      return [...prevSelected, id];
    });
  };

  const handleUpdateJobStatus = async (jobId, newStatus) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );

    try {
      await vacanciesService.updateVacancyStatus(jobId, newStatus);
    } catch (error) {
      console.error('Error al guardar el estado:', error);
      alert('Hubo un problema guardando el estado en el servidor.');
    }
  };

  const handleToggleFavorite = async (jobId, currentFavoriteStatus) => {
    const newStatus = !currentFavoriteStatus;

    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, isFavorite: newStatus } : job
      )
    );

    try {
      await vacanciesService.toggleFavorite(jobId, newStatus);
    } catch (error) {
      console.error('Error al cambiar favorito:', error);
      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job.id === jobId ? { ...job, isFavorite: currentFavoriteStatus } : job
        )
      );
    }
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

  // Lógica de Filtrado (Local)
  const filteredJobs = jobs.filter((job) => {
    // ESTADO
    const safeStatus = String(job.status || '')
      .toLowerCase()
      .trim();
    const filterStat = String(filters.status || '')
      .toLowerCase()
      .trim();
    let matchStatus = false;

    if (['all', 'todas', 'todos'].includes(filterStat)) {
      matchStatus = true;
    } else if (
      filterStat.includes('nuev') ||
      filterStat.includes('new') ||
      filterStat.includes('detect')
    ) {
      matchStatus = [
        'nueva',
        'nuevo',
        'nuevas',
        'nuevos',
        'detected',
        'new',
      ].includes(safeStatus);
    } else if (filterStat.includes('contact')) {
      matchStatus = [
        'contactada',
        'contactado',
        'contactadas',
        'contactados',
        'contacted',
      ].includes(safeStatus);
    } else if (
      filterStat.includes('proceso') ||
      filterStat.includes('progres') ||
      filterStat.includes('negotiat') ||
      filterStat.includes('interview')
    ) {
      matchStatus = [
        'en proceso',
        'en progreso',
        'negotiating',
        'interviewing',
      ].includes(safeStatus);
    } else if (
      filterStat.includes('descart') ||
      filterStat.includes('discard') ||
      filterStat.includes('reject')
    ) {
      matchStatus = [
        'descartada',
        'descartado',
        'descartadas',
        'descartados',
        'discarded',
      ].includes(safeStatus);
    } else {
      matchStatus = safeStatus === filterStat;
    }

    // SECTOR
    const filterInd = String(filters.industry || '').toLowerCase();
    let matchIndustry = false;

    if (['all', 'todas', 'todos'].includes(filterInd)) {
      matchIndustry = true;
    } else {
      const title = String(job.title || '').toLowerCase();
      const fullText =
        `${job.industry || ''} ${job.sector || ''} ${job.title || ''}`.toLowerCase();

      let assignedIndustries = [];

      // evaluacion de titulo
      if (
        title.match(
          /tech|software|\bit\b|informática|informatica|datos|data|sistemas|machine learning|backend|frontend|developer|engineer|ingenier|\bai\b|artificial/
        )
      ) {
        assignedIndustries.push('technology');
      } else if (
        title.match(
          /legal|abogad|derecho|jurídic|juridic|ley|law|lawyer|compliance|asociado/
        )
      ) {
        assignedIndustries.push('legal');
      } else if (
        title.match(
          /finan|banc|bank|contabil|seguros|insurance|mercantil|tax|fiscal|audit|econom/
        )
      ) {
        assignedIndustries.push('finance');
      } else if (
        title.match(/salud|health|médic|medic|clinic|farmacia|enferm|hospital/)
      ) {
        assignedIndustries.push('healthcare');
      } else if (
        title.match(/hostel|hospit|turism|restaur|hotel|cocin|camarer/)
      ) {
        assignedIndustries.push('hospitality');
      }

      // --- RESPALDO si el titulo no da buenos resultados
      if (assignedIndustries.length === 0) {
        if (
          fullText.match(
            /tech|software|\bit\b|informática|informatica|datos|cloud|data|sistemas|machine learning|backend|frontend|develop|engineer|ingenier|\bsap\b|\bai\b|artificial/
          )
        ) {
          assignedIndustries.push('technology');
        } else if (
          fullText.match(
            /legal|abogad|derecho|jurídic|juridic|ley|law|lawyer|compliance|asociado/
          )
        ) {
          assignedIndustries.push('legal');
        } else if (
          fullText.match(
            /finan|sales|venta|comerci|banc|bank|accou|contabil|seguros|insurance|mercantil|tax|fiscal|audit|econom/
          )
        ) {
          assignedIndustries.push('finance');
        } else if (
          fullText.match(
            /salud|health|médic|medic|clinic|farmacia|enferm|hospital/
          )
        ) {
          assignedIndustries.push('healthcare');
        } else if (
          fullText.match(/hostel|hospit|turism|restaur|hotel|cocin|camarer/)
        ) {
          assignedIndustries.push('hospitality');
        }
      }

      // Si al final no pillamos nada, le ponemos "Otros"
      if (assignedIndustries.length === 0) {
        assignedIndustries.push('otros');
      }

      // Normalizamos el filtro seleccionado en el desplegable
      let targetIndustry = filterInd;
      if (filterInd.includes('tecnolog') || filterInd.includes('tech'))
        targetIndustry = 'technology';
      else if (filterInd.includes('finanz') || filterInd.includes('finance'))
        targetIndustry = 'finance';
      else if (filterInd.includes('salud') || filterInd.includes('health'))
        targetIndustry = 'healthcare';
      else if (filterInd.includes('hostel') || filterInd.includes('hospit'))
        targetIndustry = 'hospitality';
      else if (filterInd.includes('legal') || filterInd.includes('derecho'))
        targetIndustry = 'legal';
      else if (filterInd.includes('otro')) targetIndustry = 'otros';

      matchIndustry = assignedIndustries.includes(targetIndustry);
    }

    // LOCALIZACION
    const filterLoc = String(filters.location || '').toLowerCase();
    const matchLocation =
      ['all', 'todas', 'todos'].includes(filterLoc) ||
      String(job.location || '').toLowerCase() === filterLoc;

    // PLATAFORMA
    const filterSrc = String(filters.source || '').toLowerCase();
    const jobSrcStr = String(job.source || '').toLowerCase();

    // Si elige "Todas" o si lo que elige coincide con el nombre traducido
    const matchSource =
       ['all', 'todas', 'todos'].includes(filterSrc) ||
       jobSrcStr === filterSrc;
    // FAVORITOS
    const matchFavorite = !showFavoritesOnly || job.isFavorite === true;

    let matchText = true;
    if (queryURL) {
      const lowerQuery = queryURL.toLowerCase();
      matchText =
        (job.title && job.title.toLowerCase().includes(lowerQuery)) ||
        (job.company && job.company.toLowerCase().includes(lowerQuery));
    }

    return (
      matchStatus &&
      matchIndustry &&
      matchLocation &&
      matchSource &&
      matchFavorite &&
      matchText // <--- Añadimos matchText a la comprobación final
    );
  });

  // Reset página al cambiar filtros o favoritos
  useEffect(() => {
    setPaginaActual(1);
  }, [filters, showFavoritesOnly]);

  // Cálculo de paginación
  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredJobs.length / ITEMS_POR_PAGINA)
  );
  const paginaSafe = Math.min(paginaActual, totalPaginas);

  const jobsPaginados = useMemo(() => {
    const inicio = (paginaSafe - 1) * ITEMS_POR_PAGINA;
    return filteredJobs.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [filteredJobs, paginaSafe]);

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
    filteredJobs.length === 0 ? 0 : (paginaSafe - 1) * ITEMS_POR_PAGINA + 1;
  const hasta = Math.min(paginaSafe * ITEMS_POR_PAGINA, filteredJobs.length);

  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Directorio de Vacantes</h2>
        <p className="text-muted">
          Gestiona las oportunidades laborales captadas por el sistema.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        statusOptions={['Nueva', 'Contactada', 'En proceso', 'Descartada']}
        industryOptions={[
          'Technology',
          'Finance',
          'Healthcare',
          'Hospitality',
          'Legal',
          'Otros',
        ]}
        sourceOptions={['LinkedIn', 'InfoJobs', 'Adzuna', 'Otro']}
      />

      {!loading && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted small">
            Mostrando {filteredJobs.length} vacantes de {jobs.length}
            {queryURL && (
              <span
                className="ms-2 badge bg-primary"
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                onClick={() => {
                  searchParams.delete('q');
                  setSearchParams(searchParams);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                title="Borrar búsqueda de texto"
              >
                Búsqueda: &quot;{queryURL}&quot;{' '}
                <i className="bi bi-x-circle ms-1"></i>
              </span>
            )}
          </div>

          <button
            className={`btn btn-sm ${showFavoritesOnly ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={
              showFavoritesOnly
                ? { backgroundColor: '#ffc107', borderColor: '#ffc107' }
                : {}
            }
            title="Mostrar solo favoritos"
          >
            <i
              className={`bi ${showFavoritesOnly ? 'bi-star-fill' : 'bi-star'} me-2`}
            ></i>
            Solo Favoritos
          </button>
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
        <div className="text-center p-5 text-muted">Cargando vacantes...</div>
      ) : (
        <VacancyGrid
          jobs={jobsPaginados}
          activeFilters={filters}
          selectedVacancies={selectedVacancies}
          onSelectVacancy={handleSelectVacancy}
          onUpdateJobStatus={handleUpdateJobStatus}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Paginación */}
      {!loading && totalPaginas > 1 && (
        <div className="clientes-pagination" style={{ marginTop: '1rem' }}>
          <span className="clientes-pagination__info">
            {desde}–{hasta} de {filteredJobs.length}
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
