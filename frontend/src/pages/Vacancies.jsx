import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import {
  LISTA_SECTORES,
  clasificarSectores,
  subcategoriasDe,
} from '../utils/sectores';
import BulkActions from '../components/recruitment/shared/BulkActions';
import VacancyGrid from '../components/recruitment/vacancies/VacancyGrid';
import initialJobsData from '../data/dummyData.json';
import { vacanciesService } from '../services/vacanciesService';
import { usersService } from '../services/userManagementService';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreateVacancy from '../components/recruitment/vacancies/CreateVacancies';

const OPCIONES_POR_PAGINA = [10, 20, 50];

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
  const isReclutador = hasAnyRole(['hr_manager', 'reclutador']);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryURL = searchParams.get('q') || '';

  // --- 1. ESTADOS ---
  const [filters, setFilters] = useState({
    search: queryURL,
    status: 'All',
    industry: 'All',
    subcategoria: 'All',
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
  const [itemsPorPagina, setItemsPorPagina] = useState(20);
  const [ordenarPor, setOrdenarPor] = useState('recientes');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // --- 2. OPCIONES DINÁMICAS (Para el FilterBar) ---
  // El filtro "Sector" ofrece nuestras familias profesionales (sectores).
  const mergedIndustryOptions = LISTA_SECTORES;

  // Subcategorías (profesiones) del sector elegido, para el desplegable en cascada.
  const subcatOptions =
    filters.industry && filters.industry !== 'All'
      ? subcategoriasDe(filters.industry)
      : [];

  // Clasificamos cada vacante en uno o varios sectores.
  const sectoresByJob = useMemo(() => {
    const mapa = {};
    for (const j of jobs) {
      mapa[j.id] = clasificarSectores(j.title, j.industry, j.description);
    }
    return mapa;
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
      subcategoria: 'All',
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

  const handleDeleteVacancy = async (jobId) => {
    await vacanciesService.deleteVacancy(jobId);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setSelectedVacancies((prev) => prev.filter((id) => id !== jobId));
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
      (sectoresByJob[job.id] || []).includes(filters.industry);
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
    const matchAssignedToMe = isReclutador
      ? isAssignedToMe
      : !showMyVacanciesOnly || isAssignedToMe;

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

  // --- 5b. ORDENACIÓN ---
  if (ordenarPor === 'empresa') {
    filteredJobs.sort((a, b) =>
      (a.companyName || '').localeCompare(b.companyName || '')
    );
  } else if (ordenarPor === 'estado') {
    filteredJobs.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
  } else if (ordenarPor === 'antiguos') {
    filteredJobs.sort(
      (a, b) => new Date(a.rawDate || 0) - new Date(b.rawDate || 0)
    );
  } else {
    filteredJobs.sort(
      (a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0)
    );
  }

  // --- 6. PAGINACIÓN ---
  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredJobs.length / itemsPorPagina)
  );
  const paginaSafe = Math.min(paginaActual, totalPaginas);

  const irAPagina = (p) =>
    setPaginaActual(Math.max(1, Math.min(p, totalPaginas)));

  const paginasVisibles = useMemo(() => {
    const inicio = Math.max(1, paginaSafe - 1);
    const fin = Math.min(totalPaginas, inicio + 2);
    const pages = [];
    for (let i = inicio; i <= fin; i++) pages.push(i);
    return pages;
  }, [paginaSafe, totalPaginas]);

  const jobsPaginados = useMemo(() => {
    const inicio = (paginaSafe - 1) * itemsPorPagina;
    return filteredJobs.slice(inicio, inicio + itemsPorPagina);
  }, [filteredJobs, paginaSafe, itemsPorPagina]);

  const desde =
    filteredJobs.length === 0 ? 0 : (paginaSafe - 1) * itemsPorPagina + 1;
  const hasta = Math.min(paginaSafe * itemsPorPagina, filteredJobs.length);

  // --- 7. RENDER ---
  return (
    <>
      <div className="controls-container sticky-controls">
        {/* Barra de Filtros */}
        <FilterBar
          filters={filters}
          onFilterChange={(name, val) =>
            setFilters((prev) => ({
              ...prev,
              [name]: val,
              // al cambiar de sector, reseteamos la subcategoría
              ...(name === 'industry' ? { subcategoria: 'All' } : {}),
            }))
          }
          onClearFilters={handleClearFilters}
          industryOptions={mergedIndustryOptions}
          subcategoriaOptions={subcatOptions}
          locationOptions={mergedLocationOptions}
          showMyVacanciesToggle={isNegocio}
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
        <div className="d-flex align-items-center gap-3">
          <div className="text-muted small">
            Mostrando {jobsPaginados.length} de {filteredJobs.length} vacantes
          </div>
          <label className="d-flex align-items-center gap-2 text-muted small mb-0">
            Ordenar por
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value)}
            >
              <option value="recientes">Más recientes</option>
              <option value="antiguos">Más antiguos</option>
              <option value="empresa">Empresa (A–Z)</option>
              <option value="estado">Estado</option>
            </select>
          </label>
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
          onDeleteVacancy={handleDeleteVacancy}
        />
      )}

      {/* Paginación */}
      {!loading && filteredJobs.length > 0 && (
        <div className="clientes-pagination mt-3">
          <span className="clientes-pagination__info">
            {desde}–{hasta} de {filteredJobs.length} · Página {paginaSafe} de{' '}
            {totalPaginas}
          </span>
          <div className="clientes-pagination__controls">
            <label
              className="clientes-pagination__pagesize"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginRight: '12px',
                fontSize: '0.875rem',
              }}
            >
              Ver
              <select
                value={itemsPorPagina}
                onChange={(e) => {
                  setItemsPorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
              >
                {OPCIONES_POR_PAGINA.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              por página
            </label>
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

      {/* Modal de Creación */}
      {isCreateModalOpen && (
        <CreateVacancy
          onClose={() => setIsCreateModalOpen(false)}
          onSave={async (payload) => {
            try {
              const nueva = await vacanciesService.createVacancy(payload);
              setJobs((prev) => [nueva, ...prev]);
              setIsCreateModalOpen(false);
            } catch (e) {
              alert('No se pudo guardar la vacante: ' + e.message);
            }
          }}
        />
      )}
    </>
  );
}
