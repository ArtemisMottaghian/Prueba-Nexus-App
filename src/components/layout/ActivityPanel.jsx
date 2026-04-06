export default function ActivityPanel() {
  return (
    <aside className="activity-panel theme-dark" id="activityPanel">
      <div className="activity-header">
        <h3 className="activity-title">
          <i className="bi bi-lightning-charge me-2 text-warning"></i>
          Recent Activity
        </h3>
        <button className="btn-icon d-lg-none" id="activityClose">
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="activity-scroll">
        
        {/* Actividad 1 */}
        <div className="activity-card-dark">
          <div className="activity-icon-solid bg-purple">
            <i className="bi bi-plus-circle"></i>
          </div>
          <div className="activity-content">
            <p className="user-name text-purple mb-0">Diego Santos</p>
            <p className="activity-detail">Nueva vacante capturada</p>
            <span className="activity-time"><i className="bi bi-clock me-1"></i>2 hours ago</span>
          </div>
        </div>

        {/* Actividad 2 */}
        <div className="activity-card-dark">
          <div className="activity-icon-solid bg-cyan">
            <i className="bi bi-envelope"></i>
          </div>
          <div className="activity-content">
            <p className="user-name text-cyan mb-0">María García</p>
            <p className="activity-detail">Estado cambiado a Contactada</p>
            <span className="activity-time"><i className="bi bi-clock me-1"></i>4 hours ago</span>
          </div>
        </div>

        {/* Actividad 3 */}
        <div className="activity-card-dark">
          <div className="activity-icon-solid bg-purple">
            <i className="bi bi-person-check"></i>
          </div>
          <div className="activity-content">
            <p className="user-name text-purple mb-0">Carlos López</p>
            <p className="activity-detail">Email enviado al reclutador</p>
            <span className="activity-time"><i className="bi bi-clock me-1"></i>6 hours ago</span>
          </div>
        </div>

        {/* Actividad 4 */}
        <div className="activity-card-dark">
          <div className="activity-icon-solid bg-cyan">
            <i className="bi bi-telephone"></i>
          </div>
          <div className="activity-content">
            <p className="user-name text-cyan mb-0">Ana Martínez</p>
            <p className="activity-detail">Llamada realizada</p>
            <span className="activity-time"><i className="bi bi-clock me-1"></i>8 hours ago</span>
          </div>
        </div>

      </div>

      {/* Footer del panel con botones */}
      <div className="activity-footer d-flex justify-content-between align-items-center">
        <button className="btn btn-link btn-clear-hover text-decoration-none">Clear</button>
        <button className="btn btn-view-all">View All</button>
      </div>
    </aside>
  );
}