import { useEffect, useMemo, useState } from 'react';
import SourceStatus from '../components/dashboard/SourceStatus';
import CandidateScraperStatus from '../components/dashboard/CandidateScraperStatus';
import StatsPanel from '../components/dashboard/StatsPanel';
import DashboardQuickCards from '../components/dashboard/DashboardQuickCards';
import CalendarWidget from '../components/dashboard/CalendarWidget';
import { ENDPOINTS, authFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { candidatesService } from '../services/candidatesService';
import { vacanciesService } from '../services/vacanciesService';
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

const EMPTY_RECRUITER_STATS = {
  assignedCount: 0,
  averageDays: 0,
  urgentCount: 0,
  todayEvents: 0,
  tomorrowEvents: 0,
  next7DaysEvents: 0,
  urgentVacancies: [],
};

const ROLE_BUSINESS = new Set(['admin', 'negocio', 'company']);

function getEventDate(event) {
  const dt = event?.start?.dateTime || event?.start?.date;
  return dt ? new Date(dt) : null;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getAgeInDays(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function Dashboard() {
  const { user } = useAuth();
  const [periodType, setPeriodType] = useState('day');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loadingStats, setLoadingStats] = useState(false);
  const [businessExtra, setBusinessExtra] = useState({
    activeVacancies: 0,
    finalCandidates: 0,
  });
  const [recruiterStats, setRecruiterStats] = useState(EMPTY_RECRUITER_STATS);
  const [loadingRoleData, setLoadingRoleData] = useState(false);

  const isRecruiter = user?.role === 'hr_manager';
  const isBusiness = ROLE_BUSINESS.has(user?.role);
  const shouldLoadStats = isBusiness || isRecruiter;

  useEffect(() => {
    if (!shouldLoadStats) return undefined;
    let isMounted = true;

    const loadStats = async () => {
      try {
        setLoadingStats(true);
        const { from, to } = getDateRangeForPeriod(periodType);
        const response = await authFetch(ENDPOINTS.metrics.leadStats(from, to));
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
  }, [periodType, isBusiness]);

  useEffect(() => {
    let isMounted = true;

    const loadRoleData = async () => {
      if (!user?.id && !isBusiness) return;
      setLoadingRoleData(true);

      try {
        if (isBusiness) {
          const [vacancies, finalCandidates] = await Promise.all([
            vacanciesService.getAllVacancies(),
            candidatesService.getAllCandidates({ status: 'hired_elsewhere' }),
          ]);

          if (!isMounted) return;

          const activeVacancies = vacancies.filter((v) => {
            const status = String(v.status || '').toLowerCase();
            return status !== 'descartada' && status !== 'ganada';
          }).length;

          setBusinessExtra({
            activeVacancies,
            finalCandidates: finalCandidates.length,
          });
          setRecruiterStats(EMPTY_RECRUITER_STATS);
          return;
        }

        if (isRecruiter && user?.id) {
          const [assignedVacancies, calendarResponse] = await Promise.all([
            vacanciesService.getAssignedVacancies(user.id),
            authFetch(ENDPOINTS.calendar.list),
          ]);

          if (!isMounted) return;

          const vacancyAges = assignedVacancies
            .map((vacancy) =>
              getAgeInDays(
                vacancy.assignedAt ||
                  vacancy.assigned_at ||
                  vacancy.managedAt ||
                  vacancy.rawDate
              )
            )
            .filter((n) => typeof n === 'number');

          const avgDays =
            vacancyAges.length > 0
              ? Math.round(
                  vacancyAges.reduce((acc, n) => acc + n, 0) / vacancyAges.length
                )
              : 0;

          const urgentVacancies = assignedVacancies
            .map((vacancy) => ({
              ...vacancy,
              ageDays: getAgeInDays(
                vacancy.assignedAt ||
                  vacancy.assigned_at ||
                  vacancy.managedAt ||
                  vacancy.rawDate
              ),
            }))
            .filter((v) => typeof v.ageDays === 'number' && v.ageDays >= 14)
            .sort((a, b) => b.ageDays - a.ageDays)
            .slice(0, 5);

          let events = [];
          if (calendarResponse.ok) {
            const calendarData = await calendarResponse.json();
            events = Array.isArray(calendarData?.events) ? calendarData.events : [];
          }

          const now = new Date();
          const todayStart = startOfDay(now);
          const todayEnd = endOfDay(now);
          const tomorrowStart = startOfDay(
            new Date(now.getTime() + 24 * 60 * 60 * 1000)
          );
          const tomorrowEnd = endOfDay(tomorrowStart);
          const next7DaysEnd = endOfDay(
            new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          );

          const dateEvents = events
            .map((e) => getEventDate(e))
            .filter((d) => d && !Number.isNaN(d.getTime()));

          const todayEvents = dateEvents.filter(
            (d) => d >= todayStart && d <= todayEnd
          ).length;
          const tomorrowEvents = dateEvents.filter(
            (d) => d >= tomorrowStart && d <= tomorrowEnd
          ).length;
          const next7DaysEvents = dateEvents.filter(
            (d) => d >= todayStart && d <= next7DaysEnd
          ).length;

          setRecruiterStats({
            assignedCount: assignedVacancies.length,
            averageDays: avgDays,
            urgentCount: urgentVacancies.length,
            todayEvents,
            tomorrowEvents,
            next7DaysEvents,
            urgentVacancies,
          });
          return;
        }

        setBusinessExtra({ activeVacancies: 0, finalCandidates: 0 });
        setRecruiterStats(EMPTY_RECRUITER_STATS);
      } catch (error) {
        console.error('Error loading role dashboard data:', error);
        if (!isMounted) return;
        setBusinessExtra({ activeVacancies: 0, finalCandidates: 0 });
        setRecruiterStats(EMPTY_RECRUITER_STATS);
      } finally {
        if (isMounted) setLoadingRoleData(false);
      }
    };

    loadRoleData();
    return () => {
      isMounted = false;
    };
  }, [isBusiness, isRecruiter, user?.id]);

  const businessNegotiationText = useMemo(
    () =>
      `${stats.contacted.value} contactadas · ${stats.inProgress.value} en proceso`,
    [stats.contacted.value, stats.inProgress.value]
  );

  return (
    <>
      {isBusiness && (
        <>
          <div className="mb-4 dashboard-page-intro">
            <div
              className="period-segment"
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

          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <div className="dashboard-quick-card h-100">
                <div className="text-muted small text-uppercase">
                  Vacantes activas/vigentes
                </div>
                <div className="fs-3 fw-bold text-body mt-1">
                  {loadingRoleData ? '—' : businessExtra.activeVacancies}
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="dashboard-quick-card h-100">
                <div className="text-muted small text-uppercase">
                  Estado de negociación
                </div>
                <div className="fw-semibold text-body mt-2">
                  {loadingStats ? 'Cargando…' : businessNegotiationText}
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="dashboard-quick-card h-100">
                <div className="text-muted small text-uppercase">
                  Candidatos en procesos finales
                </div>
                <div className="fs-3 fw-bold text-body mt-1">
                  {loadingRoleData ? '—' : businessExtra.finalCandidates}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4 align-items-stretch">
            <div className="col-12">
              <CalendarWidget />
            </div>
          </div>

          <SourceStatus />
          <CandidateScraperStatus />
          <StatsPanel stats={stats} />
        </>
      )}

      {isRecruiter && (
        <>
          <div className="mb-4 dashboard-page-intro">
            <div
              className="period-segment"
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

          <div className="row g-3 mb-4 align-items-stretch">
            <div className="col-12 col-lg-8">
              <div className="row g-3 align-items-stretch">
                <div className="col-12 col-md-6">
                  <div className="dashboard-quick-card h-100">
                    <div className="text-muted small text-uppercase">
                      Vacantes asignadas
                    </div>
                    <div className="fs-3 fw-bold text-body mt-1">
                      {loadingRoleData ? '—' : recruiterStats.assignedCount}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="dashboard-quick-card h-100">
                    <div className="text-muted small text-uppercase">
                      Días promedio por vacante
                    </div>
                    <div className="fs-3 fw-bold text-body mt-1">
                      {loadingRoleData ? '—' : recruiterStats.averageDays}
                    </div>
                    <div className="small text-muted">
                      Estimado por fecha publicada (preparado para fecha exacta
                      de asignación).
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4 h-100">
              <CalendarWidget />
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-7">
              <div className="dashboard-quick-card h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="h6 mb-0">Vacantes urgentes (+14 días)</h3>
                  <span className="badge text-bg-warning urgent-count-badge">
                    {recruiterStats.urgentCount}
                  </span>
                </div>
                {recruiterStats.urgentVacancies.length === 0 ? (
                  <div className="urgent-empty-state">
                    <i
                      className="bi bi-exclamation-triangle-fill urgent-empty-state__icon"
                      aria-hidden="true"
                    ></i>
                    <div className="urgent-empty-state__text">
                      <div className="urgent-empty-state__title">
                        Sin vacantes urgentes
                      </div>
                      <div className="urgent-empty-state__subtitle">
                        No hay vacantes urgentes ahora mismo.
                      </div>
                    </div>
                  </div>
                ) : (
                  <ul className="mb-0 ps-3">
                    {recruiterStats.urgentVacancies.map((vacancy) => (
                      <li key={vacancy.id} className="mb-1">
                        <span className="fw-semibold">{vacancy.title}</span>{' '}
                        <span className="text-muted">
                          ({vacancy.ageDays} días)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="col-12 col-lg-5">
              <div className="dashboard-quick-card h-100">
                <h3 className="h6 mb-2">Notificaciones</h3>
                <ul className="mb-0 ps-3">
                  <li className="mb-2">
                    Hoy tienes {recruiterStats.todayEvents} evento
                    {recruiterStats.todayEvents === 1 ? '' : 's'}.
                  </li>
                  <li className="mb-2">
                    Mañana tienes {recruiterStats.tomorrowEvents} evento
                    {recruiterStats.tomorrowEvents === 1 ? '' : 's'}.
                  </li>
                  <li>
                    Tienes {recruiterStats.urgentCount} vacante
                    {recruiterStats.urgentCount === 1 ? '' : 's'} con urgencia
                    alta.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <SourceStatus />
          <CandidateScraperStatus />
          <StatsPanel stats={stats} />
        </>
      )}

      {!isBusiness && !isRecruiter && (
        <div className="dashboard-quick-card">
          <h2 className="h6 mb-2">Dashboard</h2>
          <p className="text-muted mb-0">
            No hay una vista específica configurada para tu rol.
          </p>
        </div>
      )}
    </>
  );
}
