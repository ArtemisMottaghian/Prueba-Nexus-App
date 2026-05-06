import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import BulkActions from '../components/recruitment/shared/BulkActions';
import VacancyGrid from '../components/recruitment/vacancies/VacancyGrid';
import initialJobsData from '../data/dummyData.json';
import { vacanciesService } from '../services/vacanciesService';
import { usersService } from '../services/userManagementService';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreateVacancy from '../components/recruitment/vacancies/CreateVacancies';

const ITEMS_POR_PAGINA = 20;

// Constantes para LocalStorage (persistencia de datos)
const LS_FAV_KEY = 'nexus_vacantes_favorites';
const LS_STATUS_KEY = 'nexus_vacantes_status';
const LS_ASIGN_KEY = 'nexus_vacantes_asignaciones';

// Helper: Limpia las ubicaciones (ej: "Madrid, Spain" -> "Madrid")
function normalizeLocation(loc) {
  if (!loc) return '';
  return loc
    .replace(/\s*[([].*?[)\]]/g, '')
    .split(',')[0]
    .trim();
}

// Helper: Aplica los guardados locales por encima de los datos de la API
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
  const { user, hasAnyRole } = useAuth();
  const isNegocio = hasAnyRole(['admin', 'negocio', 'company']);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryURL = searchParams.get('q') || '';

  // --- 1. ESTADOS ---
  const [filters, setFilters] = useState({
    search: queryURL,
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
    modalidad: 'All',
  });

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVacancies, setSelectedVacancies] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDescartadas, setShowDescartadas] = useState(false);
  const [showMyVacanciesOnly, setShowMyVacanciesOnly] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // --- 2. OPCIONES DINÁMICAS (Para el FilterBar) ---
  const mergedIndustryOptions = useMemo(() => {
    const fromJobs = jobs
      .map((j) => (j.industry || j.sector || '').trim())
      .filter(Boolean);
    const defaultSectors = [
      'Tecnología / IT',
      'Recursos Humanos',
      'Ventas',
      'Marketing',
      'Finanzas',
      'Salud',
      'Ingeniería',
      'Legal',
      'Retail',
      'Logística',
      'Construcción',
      'Educación',
    ];
    return [...new Set([...defaultSectors, ...fromJobs])].sort();
  }, [jobs]);

  const mergedLocationOptions = useMemo(() => {
    const fromJobs = jobs
      .map((j) => normalizeLocation(j.location || ''))
      .filter(Boolean);
    return [...new Set([...locationOptions, ...fromJobs])].sort();
  }, [jobs, locationOptions]);

  // --- 3. CARGA DE DATOS ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [dataJobs, dataLocs] = await Promise.all([
          vacanciesService.getAllVacancies(),
          vacanciesService.getLocations(),
        ]);
        setJobs(applyLocalOverrides(dataJobs));
        setLocationOptions(dataLocs.map(normalizeLocation));
      } catch {
        console.log('Error de API, cargando datos locales de prueba...');
        setJobs(
          applyLocalOverrides(initialJobsData.vacantes || initialJobsData)
        );
      } finally {
        setLoading(false);
      }
    };
    loadData();

    if (isNegocio) {
      usersService
        .getAllUsers()
        .then((users) => {
          setHrUsers(
            users.filter((u) => u.role === 'negocio' || u.role === 'company')
          );
        })
        .catch((err) => console.error('Error al cargar usuarios', err));
    }
  }, [isNegocio]);

  // --- 4. HANDLERS (Acciones del usuario) ---
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
    setShowMyVacanciesOnly(false);
    if (searchParams.has('q')) {
      searchParams.delete('q');
      setSearchParams(searchParams);
    }
  };

  const handleUpdateJobStatus = (jobId, newStatus) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );
    const saved = JSON.parse(localStorage.getItem(LS_STATUS_KEY) || '{}');
    saved[jobId] = newStatus;
    localStorage.setItem(LS_STATUS_KEY, JSON.stringify(saved));
  };

  const handleToggleFavorite = (jobId, currentFav) => {
    const newStatus = !currentFav;
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, isFavorite: newStatus } : j))
    );
    const saved = JSON.parse(localStorage.getItem(LS_FAV_KEY) || '{}');
    saved[jobId] = newStatus;
    localStorage.setItem(LS_FAV_KEY, JSON.stringify(saved));
  };

  const handleAsignarVacante = (jobId, data) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, assignedTo: data } : j))
    );
    const saved = JSON.parse(localStorage.getItem(LS_ASIGN_KEY) || '{}');
    if (data) saved[jobId] = data;
    else delete saved[jobId];
    localStorage.setItem(LS_ASIGN_KEY, JSON.stringify(saved));
  };

  // --- 5. LÓGICA DE FILTRADO ---
  const filteredJobs = jobs.filter((job) => {
    const term = (filters.search || '').toLowerCase();
    const matchText =
      !term ||
      `${job.title} ${job.companyName} ${job.location}`
        .toLowerCase()
        .includes(term);

    const safeStatus = (job.status || '').toLowerCase();
    const isDiscarded = ['descartada', 'discarded', 'rejected'].includes(
      safeStatus
    );
    let matchStatus =
      filters.status === 'All'
        ? showDescartadas
          ? isDiscarded
          : !isDiscarded
        : safeStatus.includes(filters.status.toLowerCase());

    const matchIndustry =
      filters.industry === 'All' ||
      job.industry === filters.industry ||
      job.sector === filters.industry;
    const matchLocation =
      filters.location === 'All' ||
      normalizeLocation(job.location).includes(filters.location);
    const matchSource =
      filters.source === 'All' || job.source === filters.source;

    // Modalidad Híbrida / Remota
    const remoteText =
      `${job.location} ${job.title} ${job.description} ${job.modalidad || ''}`.toLowerCase();
    const isRem = remoteText.includes('remot');
    const isHib =
      remoteText.includes('híbrid') ||
      remoteText.includes('hibrid') ||
      remoteText.includes('hybrid');
    let matchModalidad = true;
    if (filters.modalidad === 'remoto') matchModalidad = isRem;
    else if (filters.modalidad === 'hibrido') matchModalidad = isHib;
    else if (filters.modalidad === 'presencial')
      matchModalidad = !isRem && !isHib;

    const matchFavorite = !showFavoritesOnly || job.isFavorite;

    // Filtro: Mis Vacantes
    const asignados = Array.isArray(job.assignedTo)
      ? job.assignedTo
      : job.assignedTo
        ? [job.assignedTo]
        : [];
    const isAssignedToMe = asignados.some(
      (r) =>
        r.email === user?.email ||
        r.nombre === user?.name ||
        String(r.id) === String(user?.id)
    );
    const matchAssignedToMe = !showMyVacanciesOnly || isAssignedToMe;

    return (
      matchText &&
      matchStatus &&
      matchIndustry &&
      matchLocation &&
      matchSource &&
      matchModalidad &&
      matchFavorite &&
      matchAssignedToMe
    );
  });

  // --- 6. PAGINACIÓN ---
  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredJobs.length / ITEMS_POR_PAGINA)
  );
  const paginaSafe = Math.min(paginaActual, totalPaginas);
  const jobsPaginados = useMemo(() => {
    const inicio = (paginaSafe - 1) * ITEMS_POR_PAGINA;
    return filteredJobs.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [filteredJobs, paginaSafe]);

  const desde =
    filteredJobs.length === 0 ? 0 : (paginaSafe - 1) * ITEMS_POR_PAGINA + 1;
  const hasta = Math.min(paginaSafe * ITEMS_POR_PAGINA, filteredJobs.length);

  // --- 7. RENDER ---
  return (
    <>
      <div className="controls-container sticky-controls">
        {/* Barra de Filtros */}
        <FilterBar
          filters={filters}
          onFilterChange={(name, val) =>
            setFilters((prev) => ({ ...prev, [name]: val }))
          }
          onClearFilters={handleClearFilters}
          industryOptions={mergedIndustryOptions}
          locationOptions={mergedLocationOptions}
          showMyVacanciesToggle={true}
          myVacanciesActive={showMyVacanciesOnly}
          onToggleMyVacancies={() =>
            setShowMyVacanciesOnly(!showMyVacanciesOnly)
          }
        />

        {/* Acciones en Bloque (Aparece si hay checkboxes marcados) */}
        {selectedVacancies.length > 0 && (
          <div className="bulk-actions-wrapper animate__animated animate__fadeInDown">
            <BulkActions
              selectedCount={selectedVacancies.length}
              label="vacante"
              onDiscard={async () => {
                setJobs((prev) =>
                  prev.filter((j) => !selectedVacancies.includes(j.id))
                );
                setSelectedVacancies([]);
              }}
              onAssign={async (targetUserId) => {
                const userToAssign = hrUsers.find(
                  (u) => String(u.id) === String(targetUserId)
                );
                if (userToAssign) {
                  const nuevo = {
                    id: userToAssign.id,
                    nombre: userToAssign.name,
                    email: userToAssign.email,
                    role: userToAssign.role,
                    fecha: new Date().toLocaleDateString('es-ES'),
                  };
                  setJobs((prev) =>
                    prev.map((j) =>
                      selectedVacancies.includes(j.id)
                        ? {
                            ...j,
                            assignedTo: [
                              ...(Array.isArray(j.assignedTo)
                                ? j.assignedTo
                                : j.assignedTo
                                  ? [j.assignedTo]
                                  : []),
                              nuevo,
                            ],
                          }
                        : j
                    )
                  );
                }
                setSelectedVacancies([]);
              }}
              onClear={() => setSelectedVacancies([])}
              hrUsers={hrUsers}
              showAssign={isNegocio}
            />
          </div>
        )}
      </div>

      {/* Cabecera de contadores y botones visuales */}
      <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
        <div className="text-muted small">
          Mostrando {filteredJobs.length} vacantes
        </div>

        <div className="d-flex gap-2">
          {isNegocio && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <i className="bi bi-plus-lg me-2"></i> Añadir Vacante
            </button>
          )}

          <button
            className={`btn btn-sm ${showDescartadas ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={() => {
              setShowDescartadas(!showDescartadas);
              setShowMyVacanciesOnly(false);
              setPaginaActual(1);
            }}
          >
            <i
              className={`bi ${showDescartadas ? 'bi-eye-fill' : 'bi-eye-slash'} me-2`}
            ></i>
            {showDescartadas ? 'Ver Activas' : 'Ver Descartadas'}
          </button>

          <button
            className={`btn btn-sm ${showFavoritesOnly ? 'btn-warning' : 'btn-outline-secondary'}`}
            onClick={() => {
              setShowFavoritesOnly(!showFavoritesOnly);
              setPaginaActual(1);
            }}
          >
            <i
              className={`bi ${showFavoritesOnly ? 'bi-star-fill' : 'bi-star'} me-2`}
            ></i>
            Favoritos
          </button>
        </div>
      </div>

      {/* Grid de Vacantes */}
      {loading ? (
        <div className="text-center p-5 text-muted">
          Cargando panel de vacantes...
        </div>
      ) : (
        <VacancyGrid
          jobs={jobsPaginados}
          selectedVacancies={selectedVacancies}
          onSelectVacancy={(id) =>
            setSelectedVacancies((prev) =>
              prev.includes(id)
                ? prev.filter((vId) => vId !== id)
                : [...prev, id]
            )
          }
          currentUser={user}
          isNegocio={isNegocio}
          onUpdateJobStatus={handleUpdateJobStatus}
          onToggleFavorite={handleToggleFavorite}
          onAsignarVacante={handleAsignarVacante}
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
              onClick={() => setPaginaActual(paginaSafe - 1)}
              disabled={paginaSafe === 1}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button className="clientes-pagination__btn active">
              {paginaSafe}
            </button>
            <button
              className="clientes-pagination__btn"
              onClick={() => setPaginaActual(paginaSafe + 1)}
              disabled={paginaSafe === totalPaginas}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Creación */}
      {isCreateModalOpen && (
        <CreateVacancy
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(data) => {
            setJobs((prev) => [
              { ...data, id: Date.now().toString() },
              ...prev,
            ]);
            setIsCreateModalOpen(false);
          }}
        />
      )}
    </>
  );
}
