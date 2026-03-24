import './StatsPipeline.css';

export default function StatsPipeline() {
  return (
    <div className="stats-panel mb-4">
      <div className="stats-accent"></div>

      <div className="row g-0">
        <div className="col-4">
          <div className="stats-col">
            <div className="stat-label">Nuevas</div>
            <div className="stat-number stat-number-purple">24</div>
            <div className="stat-change text-success">
              <i className="bi bi-graph-up-arrow"></i>
              <span>+12%</span>
            </div>
          </div>
        </div>

        <div className="col-4">
          <div className="stats-col">
            <div className="stat-label">Contactadas</div>
            <div className="stat-number stat-number-cyan">18</div>
            <div className="stat-change text-success">
              <i className="bi bi-graph-up-arrow"></i>
              <span>+8%</span>
            </div>
          </div>
        </div>

        <div className="col-4">
          <div className="stats-col">
            <div className="stat-label">En proceso</div>
            <div className="stat-number stat-number-violet">12</div>
            <div className="stat-change text-muted">
              <i className="bi bi-dash-lg"></i>
              <span>0%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-bar-container">
        <div className="stats-bar-track">
          <div
            className="stats-bar-purple"
            style={{ width: '44%', transition: 'width 1s ease' }}
          ></div>
          <div
            className="stats-bar-cyan"
            style={{ width: '33%', transition: 'width 1s ease' }}
          ></div>
          <div
            className="stats-bar-violet"
            style={{ width: '23%', transition: 'width 1s ease' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
