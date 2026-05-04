import { useState } from 'react';
import './FilterBar.css';

export default function FilterBar({
  filters,
  onFilterChange,
  onClearFilters,
  locationOptions = [],
  industryOptions = [
    { value: 'Technology', label: 'Tecnología' },
    { value: 'Finance', label: 'Finanzas' },
    { value: 'Healthcare', label: 'Salud' },
  ],
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
  skillsOptions = null,
  disponibilidadOptions = null,
  experienciaOptions = null,
  provinciaOptions = null,
  modalidadOptions = null,
  showVerifiedFilter = false,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const extraFilterKeys = [
    'habilidades',
    'experiencia',
    'disponibilidad',
    'provincia',
    'modalidad',
    ...(showVerifiedFilter ? ['verified'] : []),
  ];
  const hasExtraFilters = extraFilterKeys.some(
    (k) => filters[k] && filters[k] !== 'All'
  );

  const hasActiveFilters =
    filters.search ||
    filters.status !== 'All' ||
    filters.location !== 'All' ||
    filters.industry !== 'All' ||
    filters.source !== 'All' ||
    hasExtraFilters ||
    (showVerifiedFilter && filters.verified && filters.verified !== 'All');

  return (
    <div className="linkedin-filter-container">
      <div className="filter-main-row">
        <div className="search-input-group">
          <i className="bi bi-search search-icon"></i>
          <input
            type="text"
            className="search-control"
            placeholder="Buscar por título, empresa o cliente..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
          />
        </div>

        <div className="filter-pills-group">
          <div className="pill-item">
            <select
              className={`pill-select ${filters.status !== 'All' ? 'active' : ''}`}
              value={filters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
            >
              <option value="All">Estado: Todos</option>
              {statusOptions.map((opt) => (
                <option key={opt.value ?? opt} value={opt.value ?? opt}>
                  {opt.label ?? opt}
                </option>
              ))}
            </select>
          </div>

          <div className="pill-item">
            <select
              className={`pill-select ${filters.location !== 'All' ? 'active' : ''}`}
              value={filters.location}
              onChange={(e) => onFilterChange('location', e.target.value)}
            >
              <option value="All">Ubicación: Todas</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <button
            className={`btn-advanced-toggle ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <i className="bi bi-sliders me-2"></i>
            {showAdvanced ? 'Menos filtros' : 'Todos los filtros'}
          </button>

          {hasActiveFilters && (
            <button className="btn-clear-link" onClick={onClearFilters}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="filter-advanced-row animate__animated animate__fadeIn">
          <div className="advanced-grid">
            <div className="filter-group">
              <label>Sector</label>
              <select
                value={filters.industry}
                onChange={(e) => onFilterChange('industry', e.target.value)}
              >
                <option value="All">Todas</option>
                {industryOptions.map((opt) => (
                  <option key={opt.value ?? opt} value={opt.value ?? opt}>
                    {opt.label ?? opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Origen</label>
              <select
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

            {modalidadOptions && (
              <div className="filter-group">
                <label>Modalidad</label>
                <select
                  value={filters.modalidad || 'All'}
                  onChange={(e) => onFilterChange('modalidad', e.target.value)}
                >
                  <option value="All">Todas</option>
                  {modalidadOptions.map((opt) => (
                    <option key={opt.value ?? opt} value={opt.value ?? opt}>
                      {opt.label ?? opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {experienciaOptions && (
              <div className="filter-group">
                <label>Experiencia</label>
                <select
                  value={filters.experiencia || 'All'}
                  onChange={(e) =>
                    onFilterChange('experiencia', e.target.value)
                  }
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

            {skillsOptions && (
              <div className="filter-group">
                <label>Habilidades</label>
                <select
                  value={filters.habilidades || 'All'}
                  onChange={(e) =>
                    onFilterChange('habilidades', e.target.value)
                  }
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
              <div className="filter-group">
                <label>Disponibilidad</label>
                <select
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

            {provinciaOptions && (
              <div className="filter-group">
                <label>Provincia</label>
                <select
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

            {showVerifiedFilter && (
              <div className="filter-group">
                <label>Verificado</label>
                <select
                  value={filters.verified || 'All'}
                  onChange={(e) => onFilterChange('verified', e.target.value)}
                >
                  <option value="All">Todos</option>
                  <option value="yes">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
