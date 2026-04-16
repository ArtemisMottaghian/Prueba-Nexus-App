import { useState, useEffect } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import BulkActions from '../components/recruitment/shared/BulkActions';
import VacancyGrid from '../components/recruitment/vacancies/VacancyGrid';
import initialJobsData from '../data/dummyData.json';
import { vacanciesService } from '../services/vacanciesService';
import { useSearchParams } from 'react-router-dom';

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

  const handleUpdateJobStatus = (jobId, newStatus) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
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
    const safeStatus = String(job.status || '').toLowerCase();
    const filterStat = String(filters.status || '').toLowerCase();
    let matchStatus = false;

    if (['all', 'todas', 'todos'].includes(filterStat)) {
      matchStatus = true;
    } else if (filterStat.includes('nueva') || filterStat.includes('new')) {
      matchStatus = ['detected', 'new', 'nueva'].includes(safeStatus);
    } else if (filterStat.includes('contact')) {
      matchStatus = ['contacted', 'contactada'].includes(safeStatus);
    } else if (
      filterStat.includes('proceso') ||
      filterStat.includes('negotiat')
    ) {
      matchStatus = ['negotiating', 'en proceso', 'interviewing'].includes(
        safeStatus
      );
    } else if (filterStat.includes('descart')) {
      matchStatus = ['discarded', 'descartada'].includes(safeStatus);
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
      job.location === filters.location;

    // PLATAFORMA
    const filterSrc = String(filters.source || '').toLowerCase();
    const jobSrcStr = String(job.source || '').toLowerCase();

    // Si elige "Todas" o si lo que elige coincide con el nombre traducido
    const matchSource =
      ['all', 'todas', 'todos'].includes(filterSrc) || jobSrcStr === filterSrc;

    // FAVORITOS
    const matchFavorite = !showFavoritesOnly || job.isFavorite === true;

    // 👇 BÚSQUEDA POR TEXTO (TOPBAR) 👇
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

  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Vacancies Directory</h2>
        <p className="text-muted">
          Manage the job opportunities captured by the system.
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
            Showing {filteredJobs.length} vacancies of {jobs.length}
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
        <div className="text-center p-5 text-muted">Loading vacancies...</div>
      ) : (
        <VacancyGrid
          jobs={filteredJobs}
          activeFilters={filters}
          selectedVacancies={selectedVacancies}
          onSelectVacancy={handleSelectVacancy}
          onUpdateJobStatus={handleUpdateJobStatus}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </>
  );
}
