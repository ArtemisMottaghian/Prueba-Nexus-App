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

  const funnelData = [
    {
      stage: 'NUEVAS',
      value: newLeads.value,
      percentage: Math.round((newLeads.value / total) * 100),
      color: '#8b5cf6',
    },
    {
      stage: 'CONTACTADAS',
      value: contacted.value,
      percentage: Math.round((contacted.value / total) * 100),
      color: '#06b6d4',
    },
    {
      stage: 'EN PROCESO',
      value: inProgress.value,
      percentage: Math.round((inProgress.value / total) * 100),
      color: '#ec4899',
    },
  ];

  return (
    <div className="stats-panel-modern">
      <div className="stats-panel-header">
        <h3>Pipeline Analítico de Vacantes</h3>
        <span className="tech-badge">Live Data</span>
      </div>

      <div className="pipeline-split-layout">
        {/* Columna Izquierda: Embudo de Progreso */}
        <div className="pipeline-funnel-col">
          {funnelData.map((stage, idx) => (
            <div key={idx} className="stats-funnel-item">
              <div className="stats-funnel-header">
                <span
                  className="stats-funnel-title"
                  style={{ color: stage.color }}
                >
                  {stage.stage}
                </span>
                <div className="stats-funnel-values">
                  <span className="stats-funnel-count">{stage.value}</span>
                  <span className="stats-funnel-pct">{stage.percentage}%</span>
                </div>
              </div>

              <div className="stats-funnel-track">
                <div
                  className="stats-funnel-fill tech-glow"
                  style={{
                    width: `${stage.percentage}%`,
                    backgroundColor: stage.color,
                    boxShadow: `0 0 10px ${stage.color}80`,
                  }}
                />
              </div>

              {idx < funnelData.length - 1 && (
                <div className="stats-funnel-arrow">
                  <i className="bi bi-chevron-double-down"></i>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Columna Derecha: Gráfico Tecnológico */}
        <div className="pipeline-chart-col">
          <div className="tech-chart-container">
            <div className="pure-css-barchart tech-grid-bg">
              {funnelData.map((stage, idx) => (
                <div key={idx} className="pure-css-bar-wrapper group">
                  <div className="bar-value-tooltip">{stage.value}</div>
                  <div
                    className="pure-css-bar"
                    style={{
                      height: `${stage.percentage}%`,
                      background: `linear-gradient(to top, ${stage.color}aa, ${stage.color})`,
                      minHeight: stage.percentage > 0 ? '4px' : '0',
                    }}
                  />
                  <div className="bar-label-bottom">
                    {stage.stage.slice(0, 3)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leyenda Horizontal */}
          <div className="stats-chart-legend">
            {funnelData.map((stage, idx) => (
              <div key={idx} className="stats-legend-item">
                <div
                  className="stats-legend-dot"
                  style={{
                    backgroundColor: stage.color,
                    boxShadow: `0 0 5px ${stage.color}`,
                  }}
                />
                <span className="stats-legend-text">{stage.stage}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
