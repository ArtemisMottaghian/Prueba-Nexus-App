export default function FilterBar({ filters, onFilterChange, onClearFilters }) {
  
  const hasActiveFilters = 
    filters.estado !== 'Todas' || 
    filters.sector !== 'Todos' || 
    filters.ubicacion !== 'Todas' || 
    filters.origen !== 'Todos';

  return (
    <div className="filter-bar mb-4">
      <div className="row g-2 align-items-end">
        {/* Filtro Estado */}
        <div className="col-12 col-md-3">
          <label className="filter-label">Estado</label>
          <select 
            className="form-select filter-select" 
            value={filters.estado}
            onChange={(e) => onFilterChange('estado', e.target.value)}
          >
            <option value="Todas">Todas</option>
            <option value="Nueva">Nueva</option>
            <option value="Contactada">Contactada</option>
            <option value="En proceso">En proceso</option>
            <option value="Descartada">Descartada</option>
          </select>
        </div>

        {/* Filtro Sector */}
        <div className="col-12 col-md-3">
          <label className="filter-label">Sector</label>
          <select 
            className="form-select filter-select" 
            value={filters.sector}
            onChange={(e) => onFilterChange('sector', e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="Tecnología">Tecnología</option>
            <option value="Finanzas">Finanzas</option>
            <option value="Salud">Salud</option>
          </select>
        </div>

        {/* Filtro Ubicación */}
        <div className="col-12 col-md-3">
          <label className="filter-label">Ubicación</label>
          <select 
            className="form-select filter-select" 
            value={filters.ubicacion}
            onChange={(e) => onFilterChange('ubicacion', e.target.value)}
          >
            <option value="Todas">Todas</option>
            <option value="Madrid">Madrid</option>
            <option value="Barcelona">Barcelona</option>
            <option value="Remoto">Remoto</option>
          </select>
        </div>

        {/* Filtro Origen */}
        <div className="col-12 col-md-2">
          <label className="filter-label">Origen</label>
          <select 
            className="form-select filter-select" 
            value={filters.origen}
            onChange={(e) => onFilterChange('origen', e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="InfoJobs">InfoJobs</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Adzuna">Adzuna</option>
          </select>
        </div>

        {/* Botón Limpiar */}
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
    </div>
  );
}
