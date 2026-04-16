import './FilterBar.css';
export default function FilterBar({ filters, onFilterChange, onClearFilters }) {
  const hasActiveFilters =
    filters.status !== 'All' ||
    filters.industry !== 'All' ||
    filters.location !== 'All' ||
    filters.source !== 'All';

  return (
    <div className="filter-bar mb-4">
      <div className="row g-2 align-items-end">
        <div className="col-12 col-md-3">
          <label className="filter-label">ESTADO</label>
          <select
            className="form-select filter-select"
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            <option value="All">Todas</option>
            <option value="New">Nuevas</option>
            <option value="Contacted">Contactados</option>
            <option value="In progress">En progreso</option>
            <option value="Rejected">Descartados</option>
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

        {/* Location Filter */}
        <div className="col-12 col-md-3">
          <label className="filter-label">LOCALIZACIÓN</label>
          <select
            className="form-select filter-select"
            value={filters.location}
            onChange={(e) => onFilterChange('location', e.target.value)}
          >
            <option value="All">Todas</option>
            <option value="Madrid">Madrid</option>
            <option value="Barcelona">Barcelona</option>
            <option value="Valencia">Valencia</option>
            <option value="Zaragoza">Zaragoza</option>
            <option value="Remote">Remoto</option>
          </select>
        </div>

        {/* Source Filter (Origen) */}
        <div className="col-12 col-md-2">
          <label className="filter-label">ORIGEN</label>
          <select
            className="form-select filter-select"
            value={filters.source}
            onChange={(e) => onFilterChange('source', e.target.value)}
          >
            <option value="All">Todas</option>
            <option value="InfoJobs">InfoJobs</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Adzuna">Adzuna</option>
          </select>
        </div>

        {/* Clear Button */}
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
