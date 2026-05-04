import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import BulkActions from '../components/recruitment/shared/BulkActions';
import VacancyGrid from '../components/recruitment/vacancies/VacancyGrid';
import initialJobsData from '../data/dummyData.json';
import { vacanciesService } from '../services/vacanciesService';
import { usersService } from '../services/userManagementService';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// NUEVO: 1. Importamos el futuro modal de creación de vacantes
import CreateVacancy from '../components/recruitment/vacancies/CreateVacancies';

const ITEMS_POR_PAGINA = 20;

/**
 * Normaliza un string de ubicación a "Ciudad, País" limpio. */
function normalizeLocation(loc) {
  if (!loc) return '';
  return loc
    .replace(/\s*[([].*?[)\]]/g, '') // quita (Spain), [ES], etc.
    .replace(/\s*[-/]\s*(Spain|España|ES|SP)\b/gi, '') // quita "- Spain", "/ España"
    .replace(/,\s*(Spain|España|ES)\b/gi, '') // quita ", Spain"
    .replace(/\s+(Spain|España)\s*$/gi, '') // quita "Spain" al final
    .replace(/\s+ES\s*$/g, '') // quita "ES" al final
    .replace(/\s{2,}/g, ' ')
    .trim();
}
const LS_FAV_KEY = 'nexus_vacantes_favorites';
const LS_STATUS_KEY = 'nexus_vacantes_status';
const LS_ASIGN_KEY = 'nexus_vacantes_asignaciones';

const applyLocalOverrides = (jobs) => {
  const savedFavs = JSON.parse(localStorage.getItem(LS_FAV_KEY) || '{}');
  const savedStatus = JSON.parse(localStorage.getItem(LS_STATUS_KEY) || '{}');
  const savedAsign = JSON.parse(localStorage.getItem(LS_ASIGN_KEY) || '{}');
  return jobs.map((job) => ({
    ...job,
    isFavorite:
      savedFavs[job.id] !== undefined ? savedFavs[job.id] : job.isFavorite,
    status: savedStatus[job.id] || job.status,
    assignedTo: savedAsign[job.id] || job.assignedTo || null,
  }));
};

export default function Vacancies() {
  const { user, hasRole, hasAnyRole } = useAuth();
  const isReclutador = hasRole('hr_manager') || hasRole('reclutador');
  const isNegocio = hasAnyRole(['admin', 'negocio', 'company']);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryURL = searchParams.get('q') || '';

  const [filters, setFilters] = useState({
    search: queryURL,
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
    modalidad: 'All',
  });

  const [selectedVacancies, setSelectedVacancies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hrUsers, setHrUsers] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDescartadas, setShowDescartadas] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);

  // NUEVO: 2. Estado para controlar la apertura del modal de creación de vacante
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const dynamicIndustries = useMemo(() => {
    const sectors = jobs
      .map((job) => job.industry || job.sector)
      .filter(Boolean);
    return [...new Set(sectors)];
  }, [jobs]);

  // Complementar las ubicaciones del backend con las de los jobs cargados
  // Así "Remote"/"Remoto" aparece en el dropdown solo si realmente existe en los datos
  const mergedLocationOptions = useMemo(() => {
    const fromJobs = jobs
      .map((job) => normalizeLocation(job.location || ''))
      .filter(Boolean);
    const combined = [...new Set([...locationOptions, ...fromJobs])].sort();
    return combined;
  }, [jobs, locationOptions]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await vacanciesService.getAllVacancies();
        setJobs(applyLocalOverrides(data));
      } catch (error) {
        console.log('Usando dummyData.json...', error);
        setJobs(
          applyLocalOverrides(initialJobsData.vacantes || initialJobsData)
        );
      } finally {
        setLoading(false);
      }
    };

    const fetchLocations = async () => {
      try {
        const locs = await vacanciesService.getLocations();
        const normalized = [
          ...new Set((locs || []).map(normalizeLocation).filter(Boolean)),
        ].sort();
        setLocationOptions(normalized);
      } catch {
        // Backend offline — locationOptions queda vacío, no es crítico
      }
    };

    const fetchBusinessUsers = async () => {
      if (!isNegocio) return;
      try {
        const users = await usersService.getAllUsers();
        const business = users.filter(
          (u) => u.role === 'negocio' || u.role === 'company'
        );
        setHrUsers(business);
      } catch (err) {
        console.error('Error fetching business users:', err);
      }
    };

    fetchJobs();
    fetchLocations();
    fetchBusinessUsers();
  }, [isNegocio]);

  // NUEVO: 3. Función para procesar el guardado de la nueva vacante
  const handleSaveNewVacancy = async (newVacancyData) => {
    console.log('Nueva vacante lista para enviar a la API:', newVacancyData);
    // Aquí implementaremos la llamada a vacanciesService más adelante
    setIsCreateModalOpen(false);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'All',
      industry: 'All',
      location: 'All',
      source: 'All',
      modalidad: 'All',
    });
    setShowFavoritesOnly(false);

    if (searchParams.has('q')) {
      searchParams.delete('q');
      setSearchParams(searchParams);
    }
  };

  const handleSelectVacancy = (id) => {
    setSelectedVacancies((prev) =>
      prev.includes(id) ? prev.filter((vId) => vId !== id) : [...prev, id]
    );
  };

  const handleUpdateJobStatus = async (jobId, newStatus) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );
    const savedStatus = JSON.parse(localStorage.getItem(LS_STATUS_KEY) || '{}');
    savedStatus[jobId] = newStatus;
    localStorage.setItem(LS_STATUS_KEY, JSON.stringify(savedStatus));
    try {
      await vacanciesService.updateVacancyStatus(jobId, newStatus);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFavorite = async (jobId, currentFav) => {
    const newStatus = !currentFav;
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, isFavorite: newStatus } : j))
    );
    const savedFavs = JSON.parse(localStorage.getItem(LS_FAV_KEY) || '{}');
    savedFavs[jobId] = newStatus;
    localStorage.setItem(LS_FAV_KEY, JSON.stringify(savedFavs));
    try {
      await vacanciesService.toggleFavorite(jobId, newStatus);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkDiscard = async () => {
    try {
      await vacanciesService.applyBulkActions(selectedVacancies, 'discard');
      setJobs((prev) => prev.filter((j) => !selectedVacancies.includes(j.id)));
      setSelectedVacancies([]);
    } catch (e) {
      console.error(e);
      alert('Error al descartar');
    }
  };

  const handleBulkAssign = async (targetUserId) => {
    try {
      await vacanciesService.assignHr(targetUserId, selectedVacancies);

      const userToAssign = hrUsers.find(
        (u) => String(u.id) === String(targetUserId)
      );

      let nuevo = null;
      if (userToAssign) {
        nuevo = {
          id: userToAssign.id,
          nombre: userToAssign.name,
          email: userToAssign.email,
          fecha: new Date().toLocaleDateString('es-ES'),
        };
      }

      setJobs((prev) =>
        prev.map((j) => {
          if (selectedVacancies.includes(j.id) && nuevo) {
            const currentAssigned = Array.isArray(j.assignedTo)
              ? j.assignedTo
              : j.assignedTo
                ? [j.assignedTo]
                : [];
            const yaExiste = currentAssigned.some(
              (r) => String(r.id) === String(targetUserId)
            );
            if (yaExiste) return j;
            return { ...j, assignedTo: [...currentAssigned, nuevo] };
          }
          return j;
        })
      );

      setSelectedVacancies([]);
    } catch (e) {
      console.error(e);
      alert('Error al asignar');
    }
  };

  const handleAsignarVacante = (jobId, reclutadorData) => {
    // reclutadorData: { nombre, email } | null (para desasignar)
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, assignedTo: reclutadorData } : j
      )
    );
    const savedAsign = JSON.parse(localStorage.getItem(LS_ASIGN_KEY) || '{}');
    if (reclutadorData) {
      savedAsign[jobId] = reclutadorData;
    } else {
      delete savedAsign[jobId];
    }
    localStorage.setItem(LS_ASIGN_KEY, JSON.stringify(savedAsign));
  };

  const filteredJobs = jobs.filter((job) => {
    // 1. Filtro de ESTADO
    const safeStatus = (job.status || '').toLowerCase().trim();
    const filterStat = (filters.status || '').toLowerCase().trim();
    let matchStatus = false;
    const arrNew = ['nueva', 'nuevo', 'nuevas', 'nuevos', 'detected', 'new'];
    const arrContact = ['contactada', 'contactado', 'contacted'];
    const arrProcess = ['en proceso', 'negotiating', 'interviewing'];
    const arrDiscard = ['descartada', 'discarded', 'rejected'];

    if (['all', 'todas', 'todos'].includes(filterStat)) {
      // Sin filtro de estado: ocultar descartadas por defecto, mostrarlas solo si el usuario lo pide
      matchStatus = showDescartadas
        ? arrDiscard.includes(safeStatus)
        : !arrDiscard.includes(safeStatus);
    } else if (filterStat.includes('nuev') || filterStat.includes('new')) {
      matchStatus = arrNew.includes(safeStatus);
    } else if (filterStat.includes('contact')) {
      matchStatus = arrContact.includes(safeStatus);
    } else if (filterStat.includes('proceso')) {
      matchStatus = arrProcess.includes(safeStatus);
    } else if (
      filterStat.includes('descart') ||
      filterStat.includes('reject')
    ) {
      matchStatus = arrDiscard.includes(safeStatus);
    } else {
      matchStatus = safeStatus === filterStat;
    }

    const filterInd = (filters.industry || '').toLowerCase();
    let matchIndustry = true;
    if (!['all', 'todas', 'todos'].includes(filterInd)) {
      const fullText =
        `${job.industry || ''} ${job.sector || ''} ${job.title || ''}`.toLowerCase();
      matchIndustry = fullText.includes(
        filterInd.replace('tecnología', 'tech')
      );
    }

    const filterLoc = (filters.location || '').toLowerCase();
    const safeLoc = normalizeLocation(job.location || '').toLowerCase();
    const matchLocation =
      ['all', 'todas', 'todos'].includes(filterLoc) ||
      safeLoc.includes(filterLoc) ||
      (filterLoc.includes('remot') &&
        (safeLoc.includes('remot') || safeLoc.includes('remote')));

    const matchSource =
      ['all', 'todas', 'todos'].includes(filters.source.toLowerCase()) ||
      (job.source || '').toLowerCase() === filters.source.toLowerCase();

    const matchFavorite = !showFavoritesOnly || job.isFavorite === true;

    let matchText = true;
    const activeSearch = filters.search || queryURL;
    if (activeSearch) {
      const lowerQuery = activeSearch.toLowerCase();
      const textoCompleto =
        `${job.title || ''} ${job.companyName || ''} ${job.location || ''} ${job.description || ''}`.toLowerCase();
      matchText = textoCompleto.includes(lowerQuery);
    }

    // Filtro modalidad (Remoto / Presencial)
    // Busca "remot" en location, título y descripción porque el backend
    // puede indicar la modalidad en cualquiera de esos campos
    const remoteText = [
      job.location || '',
      job.title || '',
      job.description || '',
    ]
      .join(' ')
      .toLowerCase();
    const isRemote =
      remoteText.includes('remot') || remoteText.includes('remote');
    const matchModalidad =
      filters.modalidad === 'All' ||
      (filters.modalidad === 'remoto' && isRemote) ||
      (filters.modalidad === 'presencial' && !isRemote);

    // Reclutador solo ve sus vacantes asignadas (soporta array o objeto único)
    const asignados = job.assignedTo
      ? Array.isArray(job.assignedTo)
        ? job.assignedTo
        : [job.assignedTo]
      : [];
    const matchAsignado =
      !isReclutador ||
      asignados.some(
        (r) =>
          r.email === user?.email ||
          r.nombre === user?.name ||
          r.nombre === user?.username
      );

    return (
      matchStatus &&
      matchIndustry &&
      matchLocation &&
      matchSource &&
      matchFavorite &&
      matchText &&
      matchModalidad &&
      matchAsignado
    );
  });

  // Paginación (Sigue igual)
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

  const desde =
    filteredJobs.length === 0 ? 0 : (paginaSafe - 1) * ITEMS_POR_PAGINA + 1;
  const hasta = Math.min(paginaSafe * ITEMS_POR_PAGINA, filteredJobs.length);

  return (
    <>
      <div className="controls-container sticky-controls">
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          locationOptions={mergedLocationOptions}
          industryOptions={
            dynamicIndustries.length > 0
              ? dynamicIndustries
              : ['Technology', 'Finance', 'Healthcare', 'Legal']
          }
          statusOptions={['Nueva', 'Contactada', 'En proceso', 'Descartada']}
          sourceOptions={['LinkedIn', 'InfoJobs', 'Adzuna', 'Otro']}
          modalidadOptions={[
            { value: 'remoto', label: 'Remoto' },
            { value: 'presencial', label: 'Presencial' },
          ]}
        />

        {selectedVacancies.length > 0 && (
          <div className="bulk-actions-wrapper animate__animated animate__fadeInDown">
            <BulkActions
              selectedCount={selectedVacancies.length}
              label="vacante"
              onDiscard={handleBulkDiscard}
              onAssign={handleBulkAssign}
              onClear={() => setSelectedVacancies([])}
              hrUsers={hrUsers}
              showAssign={isNegocio}
            />
          </div>
        )}
      </div>

      {!loading && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted small">
            Mostrando {filteredJobs.length} vacantes de {jobs.length}
            {(filters.search || queryURL) && (
              <span
                className="ms-2 badge bg-primary"
                style={{ cursor: 'pointer' }}
                onClick={() => handleFilterChange('search', '')}
              >
                Búsqueda: &quot;{filters.search || queryURL}&quot;
                <i className="bi bi-x-circle ms-1"></i>
              </span>
            )}
          </div>

          <div className="d-flex gap-2">
            {/* NUEVO: 4. Botón para añadir vacante, visible SOLO para el rol de Negocio */}
            {isNegocio && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <i className="bi bi-plus-lg me-2"></i>
                Añadir Vacante
              </button>
            )}

            <button
              className={`btn btn-sm ${showDescartadas ? 'btn-danger' : 'btn-outline-secondary'}`}
              onClick={() => {
                setShowDescartadas(!showDescartadas);
                setShowFavoritesOnly(false);
                setPaginaActual(1);
              }}
              title="Las vacantes descartadas están ocultas por defecto"
            >
              <i
                className={`bi ${showDescartadas ? 'bi-eye-fill' : 'bi-eye-slash'} me-2`}
              ></i>
              {showDescartadas ? 'Ocultando activas' : 'Ver descartadas'}
            </button>
            <button
              className={`btn btn-sm ${showFavoritesOnly ? 'btn-warning' : 'btn-outline-secondary'}`}
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setShowDescartadas(false);
                setPaginaActual(1);
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

      {/* Aviso informativo para reclutador */}
      {!loading && isReclutador && (
        <div className="reclutador-info-banner">
          <i className="bi bi-info-circle-fill me-2"></i>
          Solo ves las vacantes que el equipo de negocio te ha asignado.
        </div>
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
          onAsignarVacante={handleAsignarVacante}
          currentUser={user}
          isNegocio={isNegocio}
          emptyStateReclutador={isReclutador}
        />
      )}

      {/* Paginación */}
      {!loading && totalPaginas > 1 && (
        <div className="clientes-pagination mt-3">
          <span className="clientes-pagination__info">
            {desde}–{hasta} de {filteredJobs.length}
          </span>
          <div className="clientes-pagination__controls">
            <button
              className="clientes-pagination__btn"
              onClick={() => irAPagina(paginaSafe - 1)}
              disabled={paginaSafe === 1}
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            <button className="clientes-pagination__btn active">
              {paginaSafe}
            </button>

            <button
              className="clientes-pagination__btn"
              onClick={() => irAPagina(paginaSafe + 1)}
              disabled={paginaSafe === totalPaginas}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* NUEVO: 5. Renderizamos el modal si el estado es true */}
      {isCreateModalOpen && (
        <CreateVacancy
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleSaveNewVacancy}
        />
      )}
    </>
  );
}
