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

function normalizeLocation(loc) {
  if (!loc) return '';
  return loc.replace(/\s*[([].*?[)\]]/g, '').split(',')[0].trim();
}

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

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVacancies, setSelectedVacancies] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDescartadas, setShowDescartadas] = useState(false);
  // Estado para Mis Vacantes
  const [showMyVacanciesOnly, setShowMyVacanciesOnly] = useState(false); 
  
  const [paginaActual, setPaginaActual] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const mergedIndustryOptions = useMemo(() => {
    const fromJobs = jobs.map((j) => (j.industry || j.sector || '').trim()).filter(Boolean);
    const defaultSectors = [
      'Tecnología / IT', 'Recursos Humanos', 'Ventas', 'Marketing', 'Finanzas', 
      'Salud', 'Ingeniería', 'Legal', 'Retail', 'Logística', 'Construcción', 'Educación'
    ];
    return [...new Set([...defaultSectors, ...fromJobs])].sort();
  }, [jobs]);

  const mergedLocationOptions = useMemo(() => {
    const fromJobs = jobs.map((j) => normalizeLocation(j.location || '')).filter(Boolean);
    return [...new Set([...locationOptions, ...fromJobs])].sort();
  }, [jobs, locationOptions]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [dataJobs, dataLocs] = await Promise.all([
          vacanciesService.getAllVacancies(),
          vacanciesService.getLocations()
        ]);
        setJobs(dataJobs);
        setLocationOptions(dataLocs.map(normalizeLocation));
      } catch (error) {
        console.log("Error de API, cargando locales...");
        setJobs(initialJobsData.vacantes || initialJobsData);
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
        // Filtramos reclutadores/HR managers para el dropdown de asignación,
        // igual que hace VacancyModal — no usuarios de negocio
        const hrUsers = users.filter(
          (u) => u.role === 'hr_manager' || u.role === 'reclutador'
        );
        setHrUsers(hrUsers);
      } catch (err) {
        console.error('Error fetching HR users:', err);
      }
    };

    fetchJobs();
    fetchLocations();
    fetchBusinessUsers();
  }, [isNegocio]);

  // Limpiar TODO (incluyendo el nuevo toggle)
  const handleClearFilters = () => {
    setFilters({ search: '', status: 'All', industry: 'All', location: 'All', source: 'All', modalidad: 'All' });
    setShowFavoritesOnly(false);
    setShowMyVacanciesOnly(false); // Reseteamos Mis Vacantes
    if (searchParams.has('q')) {
      searchParams.delete('q');
      setSearchParams(searchParams);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const term = (filters.search || '').toLowerCase();
    const matchText = !term || `${job.title} ${job.companyName} ${job.location}`.toLowerCase().includes(term);

    const safeStatus = (job.status || '').toLowerCase();
    const isDiscarded = ['descartada', 'discarded', 'rejected'].includes(safeStatus);
    let matchStatus = filters.status === 'All' 
      ? (showDescartadas ? isDiscarded : !isDiscarded)
      : safeStatus.includes(filters.status.toLowerCase());

    const matchIndustry = filters.industry === 'All' || job.industry === filters.industry || job.sector === filters.industry;
    const matchLocation = filters.location === 'All' || normalizeLocation(job.location).includes(filters.location);
    const matchSource = filters.source === 'All' || job.source === filters.source;

    const remoteText = `${job.location} ${job.title} ${job.description} ${job.modalidad || ''}`.toLowerCase();
    const isRem = remoteText.includes('remot');
    const isHib = remoteText.includes('híbrid') || remoteText.includes('hibrid') || remoteText.includes('hybrid');
    let matchModalidad = true;
    if (filters.modalidad === 'remoto') matchModalidad = isRem;
    else if (filters.modalidad === 'hibrido') matchModalidad = isHib;
    else if (filters.modalidad === 'presencial') matchModalidad = !isRem && !isHib;

    const matchFavorite = !showFavoritesOnly || job.isFavorite;

    // Filtro de Mis Vacantes
    const asignados = Array.isArray(job.assignedTo) ? job.assignedTo : (job.assignedTo ? [job.assignedTo] : []);
    const isAssignedToMe = asignados.some(r => 
      r.email === user?.email || r.nombre === user?.name || r.id === user?.id
    );
    const matchAssignedToMe = !showMyVacanciesOnly || isAssignedToMe;

    return matchText && matchStatus && matchIndustry && matchLocation && matchSource && matchModalidad && matchFavorite && matchAssignedToMe;
  });

  return (
    <>
      <div className="controls-container sticky-controls">
        <FilterBar
          filters={filters}
          onFilterChange={(name, val) => setFilters(prev => ({ ...prev, [name]: val }))}
          onClearFilters={handleClearFilters}
          industryOptions={mergedIndustryOptions}
          locationOptions={mergedLocationOptions}
          // Pasamos las props del nuevo botón
          showMyVacanciesToggle={true} 
          myVacanciesActive={showMyVacanciesOnly}
          onToggleMyVacancies={() => setShowMyVacanciesOnly(!showMyVacanciesOnly)}
        />
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
        <div className="text-muted small">
          Mostrando {filteredJobs.length} vacantes
        </div>

        <div className="d-flex gap-2">
          {isNegocio && (
            <button className="btn btn-sm btn-primary" onClick={() => setIsCreateModalOpen(true)}>
              <i className="bi bi-plus-lg me-2"></i> Añadir Vacante
            </button>
          )}

          {/* El botón de ver descartadas se queda aquí arriba porque es un cambio de vista global */}
          <button
            className={`btn btn-sm ${showDescartadas ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={() => { setShowDescartadas(!showDescartadas); setShowMyVacanciesOnly(false); }}
          >
            <i className={`bi ${showDescartadas ? 'bi-eye-fill' : 'bi-eye-slash'} me-2`}></i>
            {showDescartadas ? 'Ver Activas' : 'Ver Descartadas'}
          </button>

          <button
            className={`btn btn-sm ${showFavoritesOnly ? 'btn-warning' : 'btn-outline-secondary'}`}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <i className={`bi ${showFavoritesOnly ? 'bi-star-fill' : 'bi-star'} me-2`}></i>
            Favoritos
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-5 text-muted">Cargando panel de vacantes...</div>
      ) : (
        <VacancyGrid
          jobs={filteredJobs.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA)}
          currentUser={user}
          isNegocio={isNegocio}
          onUpdateJobStatus={(id, status) => setJobs(prev => prev.map(j => j.id === id ? {...j, status} : j))}
          onToggleFavorite={(id, fav) => setJobs(prev => prev.map(j => j.id === id ? {...j, isFavorite: !fav} : j))}
        />
      )}

      {isCreateModalOpen && (
        <CreateVacancy onClose={() => setIsCreateModalOpen(false)} onSave={(data) => {
          setJobs(prev => [{...data, id: Date.now()}, ...prev]);
          setIsCreateModalOpen(false);
        }} />
      )}
    </>
  );
}