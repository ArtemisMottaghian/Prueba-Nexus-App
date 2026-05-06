import { useState } from 'react';
import './FilterBar.css';

/**
 * Función auxiliar para renderizar opciones de forma segura y
 * evitar el error "Objects are not valid as a React child".
 */
const renderSafeOption = (opt, index, prefix) => {
  if (!opt) return null;

  const value = typeof opt === 'object' ? opt.value : opt;
  const label = typeof opt === 'object' ? opt.label : opt;

  return (
    <option key={`${prefix}-${index}`} value={value}>
      {label}
    </option>
  );
};

export default function FilterBar({
  filters,
  onFilterChange,
  onClearFilters,

  // Opciones de selects
  locationOptions = [],
  industryOptions = [],
  statusOptions = ['Nueva', 'Contactada', 'En proceso', 'Descartada'],
  sourceOptions = ['LinkedIn', 'InfoJobs', 'Adzuna', 'Carga Manual', 'Otro'],
  modalidadOptions = [
    { value: 'remoto', label: 'Remoto' },
    { value: 'hibrido', label: 'Híbrido' },
    { value: 'presencial', label: 'Presencial' },
  ],
  showVerifiedFilter = false,

  // NUEVAS PROPS: Para el botón de "Mis Vacantes"
  showMyVacanciesToggle = false,
  myVacanciesActive = false,
  onToggleMyVacancies = () => {},
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilters =
    filters.search ||
    filters.status !== 'All' ||
    filters.location !== 'All' ||
    filters.industry !== 'All' ||
    filters.source !== 'All' ||
    (filters.modalidad && filters.modalidad !== 'All') ||
    myVacanciesActive; // Sumamos el estado de "Mis Vacantes" al detector de filtros activos

  return (
    <div className="linkedin-filter-container">
      {/* --- FILA SUPERIOR --- */}
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
              value={filters.status || 'All'}
              onChange={(e) => onFilterChange('status', e.target.value)}
            >
              <option value="All">Estado: Todos</option>
              {statusOptions.map((opt, i) => renderSafeOption(opt, i, 'stat'))}
            </select>
          </div>

          <div className="pill-item">
            <select
              className={`pill-select ${filters.location !== 'All' ? 'active' : ''}`}
              value={filters.location || 'All'}
              onChange={(e) => onFilterChange('location', e.target.value)}
            >
              <option value="All">Ubicación: Todas</option>
              {locationOptions.map((loc, i) => renderSafeOption(loc, i, 'loc'))}
            </select>
          </div>

          {/* NUEVO: Botón "Mis Vacantes" integrado en la barra de filtros */}
          {showMyVacanciesToggle && (
            <button
              className={`btn-advanced-toggle ${myVacanciesActive ? 'active' : ''}`}
              onClick={onToggleMyVacancies}
              title="Filtrar solo las vacantes donde estoy asignado"
            >
              <i
                className={`bi ${myVacanciesActive ? 'bi-person-check-fill' : 'bi-person'} me-2`}
              ></i>
              Mis Vacantes
            </button>
          )}

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

      {/* --- PANEL AVANZADO --- */}
      {showAdvanced && (
        <div className="filter-advanced-row animate__animated animate__fadeIn">
          <div className="advanced-grid">
            <div className="filter-group">
              <label>Sector</label>
              <select
                value={filters.industry || 'All'}
                onChange={(e) => onFilterChange('industry', e.target.value)}
              >
                <option value="All">Todos los sectores</option>
                {industryOptions.map((opt, i) =>
                  renderSafeOption(opt, i, 'ind')
                )}
              </select>
            </div>

            <div className="filter-group">
              <label>Origen</label>
              <select
                value={filters.source || 'All'}
                onChange={(e) => onFilterChange('source', e.target.value)}
              >
                <option value="All">Todos los orígenes</option>
                {sourceOptions.map((opt, i) => renderSafeOption(opt, i, 'src'))}
              </select>
            </div>

            <div className="filter-group">
              <label>Modalidad</label>
              <select
                value={filters.modalidad || 'All'}
                onChange={(e) => onFilterChange('modalidad', e.target.value)}
              >
                <option value="All">Todas</option>
                {modalidadOptions.map((opt, i) =>
                  renderSafeOption(opt, i, 'mod')
                )}
              </select>
            </div>

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
