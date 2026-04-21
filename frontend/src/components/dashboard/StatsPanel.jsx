import './StatsPipeline.css';

const DEFAULT_STATS = {
  newLeads: { value: 0, change: 0 },
  contacted: { value: 0, change: 0 },
  inProgress: { value: 0, change: 0 },
};

export default function StatsPanel({ stats = DEFAULT_STATS }) {
  const {
    newLeads = { value: 0, change: 0 },
    contacted = { value: 0, change: 0 },
    inProgress = { value: 0, change: 0 },
  } = stats;

  const total = newLeads.value + contacted.value + inProgress.value || 1;
  const newLeadsPct = (newLeads.value / total) * 100;
  const contactedPct = (contacted.value / total) * 100;
  const inProgressPct = (inProgress.value / total) * 100;

  const getChangeClass = (change) => {
    if (change > 0) return 'text-success';
    if (change < 0) return 'text-danger';
    return 'text-muted';
  };

  const getChangeIcon = (change) => {
    if (change > 0) return 'bi bi-graph-up-arrow';
    if (change < 0) return 'bi bi-graph-down-arrow';
    return 'bi bi-dash-lg';
  };

  return (
    <div className="stats-panel mb-4">
      <div className="stats-accent"></div>

      <div className="row g-0">
        <div className="col-4">
          <div className="stats-col">
            <span className="stat-col-dot stat-col-dot--purple" aria-hidden />
            <div className="stat-label">Nuevas</div>
            <div className="stat-number stat-number-purple">
              {newLeads.value}
            </div>
            <div className={`stat-change ${getChangeClass(newLeads.change)}`}>
              <i className={getChangeIcon(newLeads.change)}></i>
              <span>
                {newLeads.change > 0 ? '+' : ''}
                {newLeads.change}%
              </span>
            </div>
          </div>
        </div>

        <div className="col-4">
          <div className="stats-col">
            <span className="stat-col-dot stat-col-dot--cyan" aria-hidden />
            <div className="stat-label">Contactadas</div>
            <div className="stat-number stat-number-cyan">
              {contacted.value}
            </div>
            <div className={`stat-change ${getChangeClass(contacted.change)}`}>
              <i className={getChangeIcon(contacted.change)}></i>
              <span>
                {contacted.change > 0 ? '+' : ''}
                {contacted.change}%
              </span>
            </div>
          </div>
        </div>

        <div className="col-4">
          <div className="stats-col">
            <span className="stat-col-dot stat-col-dot--magenta" aria-hidden />
            <div className="stat-label">En proceso</div>
            <div className="stat-number stat-number-violet">
              {inProgress.value}
            </div>
            <div className={`stat-change ${getChangeClass(inProgress.change)}`}>
              <i className={getChangeIcon(inProgress.change)}></i>
              <span>
                {inProgress.change > 0 ? '+' : ''}
                {inProgress.change}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-bar-container">
        <div className="stats-bar-track">
          <div
            className="stats-bar-purple"
            style={{ width: `${newLeadsPct}%`, transition: 'width 1s ease' }}
          ></div>
          <div
            className="stats-bar-cyan"
            style={{ width: `${contactedPct}%`, transition: 'width 1s ease' }}
          ></div>
          <div
            className="stats-bar-violet"
            style={{ width: `${inProgressPct}%`, transition: 'width 1s ease' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
