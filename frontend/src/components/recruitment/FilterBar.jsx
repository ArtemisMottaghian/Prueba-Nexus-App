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
          <label className="filter-label">Status</label>
          <select
            className="form-select filter-select"
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="In progress">In progress</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="col-12 col-md-3">
          <label className="filter-label">Industry</label>
          <select
            className="form-select filter-select"
            value={filters.industry}
            onChange={(e) => onFilterChange('industry', e.target.value)}
          >
            <option value="All">All Industries</option>
            <option value="Technology">Technology</option>
            <option value="Finance">Finance</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Hospitality">Hospitality</option>
          </select>
        </div>

        {/* Location Filter */}
        <div className="col-12 col-md-3">
          <label className="filter-label">Location</label>
          <select
            className="form-select filter-select"
            value={filters.location}
            onChange={(e) => onFilterChange('location', e.target.value)}
          >
            <option value="All">All Locations</option>
            <option value="Madrid">Madrid</option>
            <option value="Barcelona">Barcelona</option>
            <option value="Remote">Remote</option>
          </select>
        </div>

        {/* Source Filter (Origen) */}
        <div className="col-12 col-md-2">
          <label className="filter-label">Source</label>
          <select
            className="form-select filter-select"
            value={filters.source}
            onChange={(e) => onFilterChange('source', e.target.value)}
          >
            <option value="All">All Sources</option>
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
            title="Clear filters"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
