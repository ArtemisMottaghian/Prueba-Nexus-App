import './SourceStatus.css';

export default function SourceStatus() {
  return (
    <div className="row g-3 mb-4">
      {/* Adzuna - Todo OK */}
      <div className="col-12 col-md-4">
        <div className="source-card status-success">
          <div className="source-icon-wrapper bg-success-soft">
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <div className="source-info">
            <h6 className="text-white">Adzuna (API)</h6>
            <span className="source-status-text text-success">
              Sistema Online
            </span>
            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
              Extracción: Hoy 07:00 AM
            </div>
          </div>
        </div>
      </div>

      {/* LinkedIn - Advertencia */}
      <div className="col-12 col-md-4">
        <div className="source-card status-warning">
          <div className="source-icon-wrapper bg-warning-soft">
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div className="source-info">
            <h6 className="text-white">LinkedIn (Bot)</h6>
            <span className="source-status-text text-warning">
              Lentitud detectada
            </span>
            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
              Reintentando en 5min...
            </div>
          </div>
        </div>
      </div>

      {/* InfoJobs - Error */}
      <div className="col-12 col-md-4">
        <div className="source-card status-danger justify-content-between">
          <div className="d-flex align-items-center">
            <div className="source-icon-wrapper bg-danger-soft">
              <i className="bi bi-x-circle-fill"></i>
            </div>
            <div className="source-info">
              <h6 className="text-white">InfoJobs</h6>
              <span className="source-status-text text-danger">
                API Bloqueada
              </span>
            </div>
          </div>
          <button className="btn-icon btn-icon-sm" title="Reiniciar Bot">
            <i className="bi bi-arrow-clockwise text-danger"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
