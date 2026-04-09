import { useState, useEffect } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import BulkActions from '../components/recruitment/shared/BulkActions';
import VacancyGrid from '../components/recruitment/vacancies/VacancyGrid';
import initialJobsData from '../data/dummyData.json';
import { vacanciesService } from '../services/vacanciesService';

export default function Vacancies() {
  const [filters, setFilters] = useState({
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
  });

  const [selectedVacancies, setSelectedVacancies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

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
  };

  const handleSelectVacancy = (id) => {
    setSelectedVacancies((prevSelected) => {
      if (prevSelected.includes(id))
        return prevSelected.filter((vacancyId) => vacancyId !== id);
      return [...prevSelected, id];
    });
  };

  const handleUpdateJobStatus = (jobId, newStatus) => {
    // endpoint para actualizar el estado individual de una vacante.:
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
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

  // Traductor de sectores
  const getBroadIndustry = (rawSector) => {
    if (!rawSector) return 'Otros';

    const text = String(rawSector).toLowerCase();
    // Palabras clave para Technology
    if (
      text.includes('tech') ||
      text.includes('analist') ||
      text.includes('analyst') ||
      text.includes('software') ||
      text.includes('it') ||
      text.includes('AI') ||
      text.includes('backend') ||
      text.includes('frontend') ||
      text.includes('prompt') ||
      text.includes('informática') ||
      text.includes('informatica') ||
      text.includes('datos') ||
      text.includes('sistemas')
    ) {
      return 'Technology';
    }

    // Palabras clave para Finance
    if (
      text.includes('finan') ||
      text.includes('banc') ||
      text.includes('bank') ||
      text.includes('contabil') ||
      text.includes('seguros')
    ) {
      return 'Finance';
    }

    // Palabras clave para Healthcare
    if (
      text.includes('salud') ||
      text.includes('health') ||
      text.includes('médic') ||
      text.includes('medic') ||
      text.includes('clinic') ||
      text.includes('farmacia')
    ) {
      return 'Healthcare';
    }

    // Palabras clave para Hospitality
    if (
      text.includes('hostel') ||
      text.includes('hospit') ||
      text.includes('turism') ||
      text.includes('restaur') ||
      text.includes('hotel')
    ) {
      return 'Hospitality';
    }

    // Palabras clave para Legal
    if (
      text.includes('legal') ||
      text.includes('abogad') ||
      text.includes('derecho') ||
      text.includes('jurídic') ||
      text.includes('juridic') ||
      text.includes('ley') ||
      text.includes('law')
    ) {
      return 'Legal';
    }

    // Si no coincide con nada, devuelve el original o "Otros"
    return 'Otros';
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
    
    /* VARIANTE NUEVAS = ULTIMAS 24 HORAS

    if (['all', 'todas', 'todos'].includes(filterStat)) {
      matchStatus = true;
    } else if (filterStat.includes('nueva') || filterStat.includes('new')) {
      
      // Verificamos que sea una oferta sin contactar
      const isDetected = ['detected', 'new', 'nueva'].includes(safeStatus);
      
      // Calculamos si han pasado menos de 24 horas
      let isLast24h = false;
      if (job.rawDate) {
        const hoursDiff = (new Date() - new Date(job.rawDate)) / (1000 * 60 * 60);
        isLast24h = hoursDiff <= 24;
      }

      // Tiene que cumplir ambas condiciones para mostrarse
      matchStatus = isDetected && isLast24h;
    */
    } else if (filterStat.includes('contact')) {
      matchStatus = ['contacted', 'contactada'].includes(safeStatus);
    } else if (filterStat.includes('proceso') || filterStat.includes('negotiat')) {
      matchStatus = ['negotiating', 'en proceso', 'interviewing'].includes(safeStatus);
    } else if (filterStat.includes('descart')) {
      matchStatus = ['discarded', 'descartada'].includes(safeStatus);
    } else {
      matchStatus = safeStatus === filterStat;
    }

    // SECTOR INTELIGENTE
    const filterInd = String(filters.industry || '').toLowerCase();
    let matchIndustry = false;

    if (['all', 'todas', 'todos'].includes(filterInd)) {
      matchIndustry = true;
    } else {
      // Unimos el sector y el TÍTULO para buscar palabras clave
      const textToAnalyze = `${job.industry || ''} ${job.sector || ''} ${job.title || ''}`.toLowerCase();

      let assignedIndustry = 'otros';
      if (textToAnalyze.match(/tech|software|it|informática|informatica|datos|data|sistemas|machine learning|backend|frontend|developer|engineer|sap|ai|artificial/)) {
        assignedIndustry = 'technology';
      } else if (textToAnalyze.match(/finan|banc|bank|contabil|seguros|insurance/)) {
        assignedIndustry = 'finance';
      } else if (textToAnalyze.match(/salud|health|médic|medic|clinic|farmacia/)) {
        assignedIndustry = 'healthcare';
      } else if (textToAnalyze.match(/hostel|hospit|turism|restaur|hotel/)) {
        assignedIndustry = 'hospitality';
      } else if (textToAnalyze.match(/legal|abogad|derecho|jurídic|juridic|ley|law/)) {
        assignedIndustry = 'legal';
      }

      // Normalizamos lo que eligió el usuario
      let targetIndustry = filterInd;
      if (filterInd.includes('tecnolog') || filterInd.includes('tech')) targetIndustry = 'technology';
      else if (filterInd.includes('finanz') || filterInd.includes('finance')) targetIndustry = 'finance';
      else if (filterInd.includes('salud') || filterInd.includes('health')) targetIndustry = 'healthcare';
      else if (filterInd.includes('hostel') || filterInd.includes('hospit')) targetIndustry = 'hospitality';
      else if (filterInd.includes('legal') || filterInd.includes('derecho')) targetIndustry = 'legal';
      else if (filterInd.includes('otro')) targetIndustry = 'otros';

      matchIndustry = assignedIndustry === targetIndustry;
    }

    // LOCALIZACION
    const filterLoc = String(filters.location || '').toLowerCase();
    const matchLocation = ['all', 'todas', 'todos'].includes(filterLoc) || job.location === filters.location;

    // PLATAFORMA
    const filterSrc = String(filters.source || '').toLowerCase();
    const matchSource = ['all', 'todas', 'todos'].includes(filterSrc) || 
                        String(job.source).toLowerCase() === filterSrc || 
                        String(job.portal_id) === filterSrc;

    return matchStatus && matchIndustry && matchLocation && matchSource;
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
        // Añadidas opciones Legal y Otros
        industryOptions={['Technology', 'Finance', 'Healthcare', 'Hospitality', 'Legal', 'Otros']}
      />

      {!loading && (
        <div className="mb-3 text-muted small">
          Showing {filteredJobs.length} vacancies of {jobs.length}
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
        />
      )}
    </>
  );
}