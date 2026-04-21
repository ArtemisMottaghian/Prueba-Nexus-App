import './FilterBar.css';

export default function FilterBar({
  filters,
  onFilterChange,
  onClearFilters,
  locationOptions = [],
  statusOptions = [
    { value: 'New', label: 'Nuevas' },
    { value: 'Contacted', label: 'Contactados' },
    { value: 'In progress', label: 'En progreso' },
    { value: 'Rejected', label: 'Descartados' },
  ],
  sourceOptions = [
    { value: 'InfoJobs', label: 'InfoJobs' },
    { value: 'LinkedIn', label: 'LinkedIn' },
    { value: 'Adzuna', label: 'Adzuna' },
  ],
  // Filtros opcionales para candidatos (#108)
  skillsOptions = null,
  disponibilidadOptions = null,
  experienciaOptions = null,
  provinciaOptions = null,
}) {
  const extraFilterKeys = [
    'habilidades',
    'disponibilidad',
    'experiencia',
    'provincia',
  ];
  const hasExtraFilters = extraFilterKeys.some(
    (k) => filters[k] && filters[k] !== 'All'
  );

  const hasActiveFilters =
    filters.status !== 'All' ||
    filters.industry !== 'All' ||
    filters.location !== 'All' ||
    filters.source !== 'All' ||
    hasExtraFilters;

  return (
    <div className="filter-bar mb-4">
      {/* Fila 1: filtros base */}
      <div className="row g-2 align-items-end">
        <div className="col-12 col-md-3">
          <label className="filter-label">ESTADO</label>
          <select
            className="form-select filter-select"
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            <option value="All">Todas</option>
            {statusOptions.map((opt) => (
              <option key={opt.value ?? opt} value={opt.value ?? opt}>
                {opt.label ?? opt}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-3">
          <label className="filter-label">SECTOR</label>
          <select
            className="form-select filter-select"
            value={filters.industry}
            onChange={(e) => onFilterChange('industry', e.target.value)}
          >
            <option value="All">Todas</option>
            <option value="Technology">Tecnología</option>
            <option value="Finance">Finanzas</option>
            <option value="Healthcare">Salud</option>
            <option value="Hospitality">Hostelería</option>
            <option value="Legal">Legal</option>
            <option value="Otro">Otros</option>
          </select>
        </div>

        <div className="col-12 col-md-3">
          <label className="filter-label">LOCALIZACIÓN</label>
          <select
            className="form-select filter-select"
            value={filters.location}
            onChange={(e) => onFilterChange('location', e.target.value)}
          >
            <option value="All">Todas</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-2">
          <label className="filter-label">ORIGEN</label>
          <select
            className="form-select filter-select"
            value={filters.source}
            onChange={(e) => onFilterChange('source', e.target.value)}
          >
            <option value="All">Todas</option>
            {sourceOptions.map((opt) => (
              <option key={opt.value ?? opt} value={opt.value ?? opt}>
                {opt.label ?? opt}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-1">
          <button
            className="btn btn-clear w-100"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            title="Limpiar filtros"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      {/* Fila 2: filtros extra de candidatos (#108) — solo si se pasan opciones */}
      {(skillsOptions ||
        disponibilidadOptions ||
        experienciaOptions ||
        provinciaOptions) && (
        <div className="row g-2 align-items-end mt-2">
          {skillsOptions && (
            <div className="col-12 col-md-3">
              <label className="filter-label">HABILIDADES</label>
              <select
                className="form-select filter-select"
                value={filters.habilidades || 'All'}
                onChange={(e) => onFilterChange('habilidades', e.target.value)}
              >
                <option value="All">Todas</option>
                {skillsOptions.map((opt) => (
                  <option key={opt.value ?? opt} value={opt.value ?? opt}>
                    {opt.label ?? opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {disponibilidadOptions && (
            <div className="col-12 col-md-3">
              <label className="filter-label">DISPONIBILIDAD</label>
              <select
                className="form-select filter-select"
                value={filters.disponibilidad || 'All'}
                onChange={(e) =>
                  onFilterChange('disponibilidad', e.target.value)
                }
              >
                <option value="All">Todas</option>
                {disponibilidadOptions.map((opt) => (
                  <option key={opt.value ?? opt} value={opt.value ?? opt}>
                    {opt.label ?? opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {experienciaOptions && (
            <div className="col-12 col-md-3">
              <label className="filter-label">EXPERIENCIA</label>
              <select
                className="form-select filter-select"
                value={filters.experiencia || 'All'}
                onChange={(e) => onFilterChange('experiencia', e.target.value)}
              >
                <option value="All">Todas</option>
                {experienciaOptions.map((opt) => (
                  <option key={opt.value ?? opt} value={opt.value ?? opt}>
                    {opt.label ?? opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {provinciaOptions && (
            <div className="col-12 col-md-3">
              <label className="filter-label">PROVINCIA</label>
              <select
                className="form-select filter-select"
                value={filters.provincia || 'All'}
                onChange={(e) => onFilterChange('provincia', e.target.value)}
              >
                <option value="All">Todas</option>
                {provinciaOptions.map((opt) => (
                  <option key={opt.value ?? opt} value={opt.value ?? opt}>
                    {opt.label ?? opt}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
