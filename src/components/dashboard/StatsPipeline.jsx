import './StatsPipeline.css';
export default function StatsPipeline() {
  return (
    <div className="stats-panel mb-4">
      {/* Línea decorativa superior */}
      <div className="stats-accent"></div>

      <div className="row g-0">
        {/* Columna: Nuevas */}
        <div className="col-4">
          <div className="stats-col">
            <div className="stat-label">Nuevas</div>
            <div className="stat-number stat-number-purple">24</div>
            <div className="stat-change text-success">
              <i className="bi bi-arrow-up-short"></i>
              <span>+12%</span>
            </div>
          </div>
        </div>

        {/* Columna: Contactadas */}
        <div className="col-4">
          <div className="stats-col">
            <div className="stat-label">Contactadas</div>
            <div className="stat-number stat-number-cyan">18</div>
            <div className="stat-change text-success">
              <i className="bi bi-arrow-up-short"></i>
              <span>+8%</span>
            </div>
          </div>
        </div>

        {/* Columna: En Proceso */}
        <div className="col-4">
          <div className="stats-col">
            <div className="stat-label">En proceso</div>
            <div className="stat-number stat-number-violet">12</div>
            <div className="stat-change text-warning">
              <i className="bi bi-arrow-right-short"></i>
              <span>0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de progreso inferior (El width se queda en línea por ser dato dinámico) */}
      <div className="stats-bar-container">
        <div className="stats-bar-track">
          <div className="stats-bar-purple" style={{ width: '44%' }}></div>
          <div className="stats-bar-cyan" style={{ width: '33%' }}></div>
          <div className="stats-bar-violet" style={{ width: '23%' }}></div>
        </div>
      </div>
    </div>
  );
}
