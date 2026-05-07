import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import './DashboardQuickCards.css';

const PERIOD_LABELS = {
  day: 'Hoy',
  week: 'Últimos 7 días',
  month: 'Últimos 30 días',
};

// Componente SVG puro para la gráfica (Sparkline) - SIN librerías
const MiniSparkline = ({ data }) => {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const width = 80;
  const height = 30;
  const step = width / (data.length - 1);

  // Calcula las coordenadas para la línea
  const points = data
    .map((d, i) => {
      const x = i * step;
      const y = height - ((d.value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width="80"
      height="40"
      viewBox="0 -5 80 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline
        points={points}
        stroke="#8b5cf6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function DashboardQuickCards({ stats, periodType, loading }) {
  const pipelineTotal = useMemo(
    () =>
      (stats?.newLeads?.value ?? 0) +
      (stats?.contacted?.value ?? 0) +
      (stats?.inProgress?.value ?? 0),
    [stats]
  );

  const periodLabel = PERIOD_LABELS[periodType] ?? periodType;

  // Datos para nuestra mini gráfica
  const sparklineData = [
    { value: 4 },
    { value: 5 },
    { value: 3 },
    { value: 6 },
    { value: 5 },
    { value: 6 },
  ];

  return (
    <div className="quick-cards-grid">
      {/* Tarjeta 1: Resumen del periodo */}
      <div className="quick-card-modern">
        <div className="quick-card-header">
          <div className="quick-card-icon-wrapper violet">
            <i className="bi bi-activity"></i>
          </div>
          <span className="quick-card-badge">
            <i className="bi bi-graph-up"></i>+12%
          </span>
        </div>

        <p className="quick-card-subtitle">Resumen del período</p>

        <div className="quick-card-main-row">
          <h3 className="quick-card-value">{loading ? '—' : pipelineTotal}</h3>
          <div className="quick-card-chart">
            <MiniSparkline data={sparklineData} />
          </div>
        </div>

        <p className="quick-card-footer">
          Vacantes en pipeline ({periodLabel})
        </p>
      </div>

      {/* Tarjeta 2: Enlace a Vacantes */}
      <Link to="/vacantes" className="quick-card-modern">
        <div className="quick-card-header">
          <div className="quick-card-icon-wrapper cyan">
            <i className="bi bi-briefcase"></i>
          </div>
        </div>

        <p className="quick-card-subtitle">Vacantes</p>

        <div className="quick-card-main-row">
          <h3 className="quick-card-value" style={{ fontSize: '1.5rem' }}>
            Directorio y filtros
          </h3>
        </div>

        <div className="quick-card-link-text">
          Ir a vacantes <i className="bi bi-arrow-right-short"></i>
        </div>
      </Link>
    </div>
  );
}
