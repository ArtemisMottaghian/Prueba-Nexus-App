export default function ActivityPanel({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <>
      {/* Fondo oscuro en móvil para cerrar al hacer clic fuera */}
      <div
        className="d-lg-none"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1040,
        }}
        onClick={onClose}
      />

      <aside className="activity-panel theme-dark" id="activityPanel" style={{ zIndex: 1045 }}>
        <div className="activity-header">
          <h3 className="activity-title">
            <i className="bi bi-lightning-charge me-2 text-warning"></i>
            Recent Activity
          </h3>
          <button className="btn-icon" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="activity-scroll">

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

        <div className="activity-footer d-flex justify-content-between align-items-center">
          <button className="btn btn-link btn-clear-hover text-decoration-none" onClick={onClose}>
            Clear
          </button>
          <button className="btn btn-view-all" onClick={onClose}>
            View All
          </button>
        </div>
      </aside>
    </>
  );
}