import { useEffect, useState } from 'react';
import SourceStatus from '../components/dashboard/SourceStatus';
import StatsPanel from '../components/dashboard/StatsPanel';
import DashboardQuickCards from '../components/dashboard/DashboardQuickCards';
import { ENDPOINTS } from '../services/api';
import '../components/dashboard/DashboardQuickCards.css';

function getDateRangeForPeriod(periodType) {
  const end = new Date();
  const start = new Date();
  if (periodType === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (periodType === 'week') {
    start.setDate(end.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else {
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
        const response = await fetch(ENDPOINTS.metrics.leadStats(from, to));
        if (!response.ok) {
          throw new Error(`Failed to load stats (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          console.error(
            'Metrics API did not return JSON. Content-Type:',
            contentType,
            text.slice(0, 500)
          );
          throw new Error('Non-JSON response from /api/metrics');
        }

        const data = await response.json();
        if (!isMounted) return;

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
      } catch (error) {
        console.error('Could not load dashboard stats:', error);
        if (!isMounted) return;
        setStats(EMPTY_STATS);
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
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Visión General</h2>
        <p className="text-muted">
          Resumen de actividad de los bots y estado comercial.
        </p>
        <div
          className="period-segment mt-3"
          role="group"
          aria-label="Filtro de periodo"
        >
          <button
            type="button"
            className={`period-segment__btn ${
              periodType === 'day' ? 'period-segment__btn--active' : ''
            }`}
            onClick={() => setPeriodType('day')}
            disabled={loadingStats}
            aria-pressed={periodType === 'day'}
          >
            Día
          </button>
          <button
            type="button"
            className={`period-segment__btn ${
              periodType === 'week' ? 'period-segment__btn--active' : ''
            }`}
            onClick={() => setPeriodType('week')}
            disabled={loadingStats}
            aria-pressed={periodType === 'week'}
          >
            Semana
          </button>
          <button
            type="button"
            className={`period-segment__btn ${
              periodType === 'month' ? 'period-segment__btn--active' : ''
            }`}
            onClick={() => setPeriodType('month')}
            disabled={loadingStats}
            aria-pressed={periodType === 'month'}
          >
            Mes
          </button>
        </div>
      </div>

      <DashboardQuickCards
        stats={stats}
        periodType={periodType}
        loading={loadingStats}
      />

      <SourceStatus />
      <StatsPanel stats={stats} />
    </>
  );
}
