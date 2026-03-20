import FilterBar from '../components/recruitment/FilterBar';
import VacancyGrid from '../components/recruitment/VacancyGrid';

export default function Vacancies() {
  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Directorio de Vacantes</h2>
        <p className="text-muted">
          Gestiona las oportunidades capturadas por el sistema.
        </p>
      </div>
      <FilterBar />
      <VacancyGrid />
    </>
  );
}
