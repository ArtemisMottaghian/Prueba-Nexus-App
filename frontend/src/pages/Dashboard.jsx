import { useEffect, useState } from 'react';
import SourceStatus from '../components/dashboard/SourceStatus';
import CandidateScraperStatus from '../components/dashboard/CandidateScraperStatus';
import StatsPanel from '../components/dashboard/StatsPanel';
import DashboardQuickCards from '../components/dashboard/DashboardQuickCards';
import CalendarWidget from '../components/dashboard/CalendarWidget';
import { ENDPOINTS, authFetch } from '../services/api';
import '../components/dashboard/DashboardQuickCards.css';

function getDateRangeForPeriod(periodType) {
  const end = new Date();
  const start = new Date();
  if (periodType === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (periodType === 'week') {
    start.setDate(end.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (periodType === 'month') {
    start.setDate(end.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

const EMPTY_STATS = {
  newLeads: { value: 0, change: 0 },
  contacted: { value: 0, change: 0 },
  inProgress: { value: 0, change: 0 },
};

export default function Dashboard() {
  const [periodType, setPeriodType] = useState('day');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        setLoadingStats(true);
        const { from, to } = getDateRangeForPeriod(periodType);

        // Llamada a la API de métricas pasando el rango de fechas
        const response = await authFetch(ENDPOINTS.metrics.leadStats(from, to));

        if (!response.ok) throw new Error('Error al cargar estadísticas');

        const data = await response.json();

        if (isMounted) {
          setStats({
            newLeads: { value: data.new ?? 0, change: data.newChange ?? 0 },
            contacted: {
              value: data.contacted ?? 0,
              change: data.contactedChange ?? 0,
            },
            inProgress: {
              value: data.inProgress ?? 0,
              change: data.inProgressChange ?? 0,
            },
          });
        }
      } catch (error) {
        console.error('Error en Dashboard:', error);
        if (isMounted) setStats(EMPTY_STATS);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [periodType]);

  return (
    <div
      className="dashboard-wrapper"
      style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}
    >
      {/* 1. Selector de Periodo (Día, Semana, Mes) */}
      <div className="mb-4 dashboard-page-intro">
        <div
          className="period-segment"
          role="group"
          aria-label="Filtro de periodo"
        >
          {['day', 'week', 'month'].map((p) => (
            <button
              key={p}
              type="button"
              className={`period-segment__btn ${periodType === p ? 'period-segment__btn--active' : ''}`}
              onClick={() => setPeriodType(p)}
              disabled={loadingStats}
            >
              {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Tarjetas de resumen rápido (KPIs) */}
      <DashboardQuickCards
        stats={stats}
        periodType={periodType}
        loading={loadingStats}
      />

      {/* 3. Sistema de Rejilla Principal */}
      <div className="dashboard-grid-system">
        {/* Columna Izquierda: Estados de scraping y paneles detallados */}
        <div className="dashboard-main-content">
          <SourceStatus />
          <CandidateScraperStatus />
          <StatsPanel stats={stats} />
        </div>

        {/* Columna Derecha / Lateral: Widget de Calendario Híbrido */}
        <aside className="dashboard-sidebar">
          <CalendarWidget />
        </aside>
      </div>
    </div>
  );
}
