export default function BotStatusGrid() {
  return (
    <div className="row g-3 mb-4">
      {/* Adzuna - Todo OK */}
      <div className="col-12 col-md-4">
        <div className="alert alert-bot-success d-flex align-items-center mb-0">
          <i className="bi bi-check-circle-fill text-success fs-4 me-3"></i>
          <div>
            <h6 className="mb-0 text-white">Adzuna (API)</h6>
            <small className="text-muted">Última extr.: Hoy 07:00 AM</small>
          </div>
        </div>
      </div>

      {/* LinkedIn - Advertencia */}
      <div className="col-12 col-md-4">
        <div className="alert alert-bot-warning d-flex align-items-center mb-0">
          <i className="bi bi-exclamation-triangle-fill text-warning fs-4 me-3"></i>
          <div>
            <h6 className="mb-0 text-white">LinkedIn (Bot)</h6>
            <small className="text-muted">Lentitud detectada</small>
          </div>
        </div>
      </div>

      {/* InfoJobs - Error */}
      <div className="col-12 col-md-4">
        <div className="alert alert-bot-danger d-flex align-items-center justify-content-between mb-0">
          <div className="d-flex align-items-center">
            <i className="bi bi-x-circle-fill text-danger fs-4 me-3"></i>
            <div>
              <h6 className="mb-0 text-white">InfoJobs</h6>
              <small className="text-muted">API Bloqueada</small>
            </div>
          </div>
          <button className="btn btn-sm btn-outline-danger">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
