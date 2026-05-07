import { useEffect, useMemo, useState } from 'react';
import SourceStatus from '../components/dashboard/SourceStatus';
import CandidateScraperStatus from '../components/dashboard/CandidateScraperStatus';
import StatsPanel from '../components/dashboard/StatsPanel';
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

  const pipelineTotal = useMemo(
    () =>
      (stats?.newLeads?.value ?? 0) +
      (stats?.contacted?.value ?? 0) +
      (stats?.inProgress?.value ?? 0),
    [stats]
  );

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
  }, [periodType, shouldLoadStats]);

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
                  vacancyAges.reduce((acc, n) => acc + n, 0) /
                    vacancyAges.length
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
            events = Array.isArray(calendarData?.events)
              ? calendarData.events
              : [];
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

  return (
    <>
      {isBusiness && (
        <>
          <div className="dashboard-header-modern">
            <div className="dashboard-header-title"></div>
            <div
              className="period-segment-modern"
              role="group"
              aria-label="Filtro de periodo"
            >
              <button
                type="button"
                className={`period-segment__btn ${periodType === 'day' ? 'period-segment__btn--active' : ''}`}
                onClick={() => setPeriodType('day')}
                disabled={loadingStats}
              >
                Día
              </button>
              <button
                type="button"
                className={`period-segment__btn ${periodType === 'week' ? 'period-segment__btn--active' : ''}`}
                onClick={() => setPeriodType('week')}
                disabled={loadingStats}
              >
                Semana
              </button>
              <button
                type="button"
                className={`period-segment__btn ${periodType === 'month' ? 'period-segment__btn--active' : ''}`}
                onClick={() => setPeriodType('month')}
                disabled={loadingStats}
              >
                Mes
              </button>
            </div>
          </div>

          <div className="four-cards-grid">
            <div className="tc-modern">
              <div className="tc-header">
                <div
                  className="tc-icon"
                  style={{ background: '#f5f3ff', color: '#8b5cf6' }}
                >
                  <i className="bi bi-activity"></i>
                </div>
                <span className="tc-trend green">
                  <i className="bi bi-graph-up-arrow"></i> +12%
                </span>
              </div>
              <div className="tc-title">Resumen del Período</div>
              <div className="tc-body">
                <h3 className="tc-value">
                  {loadingStats ? '—' : pipelineTotal}
                </h3>
                <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
                  <path
                    d="M0 10 L10 5 L20 15 L30 10 L40 18 L50 2 L60 8"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="tc-footer">
                Vacantes en pipeline (nuevas + contactadas + en proceso)
              </p>
            </div>

            <div className="tc-modern">
              <div className="tc-header">
                <div
                  className="tc-icon"
                  style={{ background: '#eff6ff', color: '#3b82f6' }}
                >
                  <i className="bi bi-briefcase"></i>
                </div>
                <span className="tc-trend green">
                  <i className="bi bi-graph-up-arrow"></i> +8%
                </span>
              </div>
              <div className="tc-title">Vacantes Activas/Vigentes</div>
              <div className="tc-body">
                <h3 className="tc-value">
                  {loadingRoleData ? '—' : businessExtra.activeVacancies}
                </h3>
                <svg width="60" height="4" viewBox="0 0 60 4" fill="none">
                  <rect width="60" height="4" rx="2" fill="#3b82f6" />
                </svg>
              </div>
              <p className="tc-footer">Directorio y filtros</p>
            </div>

            <div className="tc-modern">
              <div className="tc-header">
                <div
                  className="tc-icon"
                  style={{ background: '#ecfeff', color: '#06b6d4' }}
                >
                  <i className="bi bi-file-text"></i>
                </div>
                <span className="tc-trend grey">
                  <i className="bi bi-dash"></i> ~ 0%
                </span>
              </div>
              <div className="tc-title">Estado de Negociación</div>
              <div
                className="tc-body"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                  }}
                >
                  <h3 className="tc-value" style={{ fontSize: '1.5rem' }}>
                    {loadingStats ? '—' : stats.contacted.value}
                  </h3>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    contactadas
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                  }}
                >
                  <h3 className="tc-value" style={{ fontSize: '1.5rem' }}>
                    {loadingStats ? '—' : stats.inProgress.value}
                  </h3>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    en proceso
                  </span>
                </div>
              </div>
            </div>

            <div className="tc-modern">
              <div className="tc-header">
                <div
                  className="tc-icon"
                  style={{ background: '#fdf4ff', color: '#d946ef' }}
                >
                  <i className="bi bi-people"></i>
                </div>
                <span className="tc-trend grey">
                  <i className="bi bi-dash"></i> ~ 0%
                </span>
              </div>
              <div className="tc-title">Candidatos Procesos Finales</div>
              <div className="tc-body">
                <h3 className="tc-value">
                  {loadingRoleData ? '—' : businessExtra.finalCandidates}
                </h3>
              </div>
              <p className="tc-footer">En últimas etapas de selección</p>
            </div>
          </div>

          {/* Layout Principal Scrapers y Calendario */}
          <div
            className="main-layout-modern"
            style={{ marginBottom: '1.5rem' }}
          >
            <div className="left-col-modern">
              <SourceStatus />
              <CandidateScraperStatus />
            </div>
            <div>
              <CalendarWidget />
            </div>
          </div>

          {/* Pipeline a todo el ancho debajo de los Scrapers y el Calendario */}
          <StatsPanel stats={stats} />
        </>
      )}

      {isRecruiter && (
        <>
          <div className="dashboard-header-modern">
            <div className="dashboard-header-title">
              <h1>Nexus Dashboard</h1>
              <p>Panel del reclutador</p>
            </div>
            <div
              className="period-segment-modern"
              role="group"
              aria-label="Filtro de periodo"
            >
              <button
                type="button"
                className={`period-segment__btn ${periodType === 'day' ? 'period-segment__btn--active' : ''}`}
                onClick={() => setPeriodType('day')}
                disabled={loadingStats}
              >
                Día
              </button>
              <button
                type="button"
                className={`period-segment__btn ${periodType === 'week' ? 'period-segment__btn--active' : ''}`}
                onClick={() => setPeriodType('week')}
                disabled={loadingStats}
              >
                Semana
              </button>
              <button
                type="button"
                className={`period-segment__btn ${periodType === 'month' ? 'period-segment__btn--active' : ''}`}
                onClick={() => setPeriodType('month')}
                disabled={loadingStats}
              >
                Mes
              </button>
            </div>
          </div>

          <div className="four-cards-grid">
            <div className="tc-modern">
              <div className="tc-header">
                <div
                  className="tc-icon"
                  style={{ background: '#f5f3ff', color: '#8b5cf6' }}
                >
                  <i className="bi bi-activity"></i>
                </div>
                <span className="tc-trend green">
                  <i className="bi bi-graph-up-arrow"></i> +12%
                </span>
              </div>
              <div className="tc-title">Resumen del Período</div>
              <div className="tc-body">
                <h3 className="tc-value">
                  {loadingStats ? '—' : pipelineTotal}
                </h3>
                <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
                  <path
                    d="M0 10 L10 5 L20 15 L30 10 L40 18 L50 2 L60 8"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="tc-footer">
                Vacantes en pipeline (nuevas + contactadas + en proceso)
              </p>
            </div>

            <div className="tc-modern">
              <div className="tc-header">
                <div
                  className="tc-icon"
                  style={{ background: '#eff6ff', color: '#3b82f6' }}
                >
                  <i className="bi bi-briefcase"></i>
                </div>
              </div>
              <div className="tc-title">Vacantes asignadas</div>
              <div className="tc-body">
                <h3 className="tc-value">
                  {loadingRoleData ? '—' : recruiterStats.assignedCount}
                </h3>
              </div>
              <p className="tc-footer">Directorio y filtros</p>
            </div>

            <div className="tc-modern">
              <div className="tc-header">
                <div
                  className="tc-icon"
                  style={{ background: '#f5f3ff', color: '#8b5cf6' }}
                >
                  <i className="bi bi-calendar-check"></i>
                </div>
              </div>
              <div className="tc-title">Días promedio por vacante</div>
              <div className="tc-body">
                <h3 className="tc-value">
                  {loadingRoleData ? '—' : recruiterStats.averageDays}
                </h3>
              </div>
              <p className="tc-footer">Estimado por fecha de asignación</p>
            </div>

            <div className="tc-modern" style={{ padding: '1rem' }}>
              <div className="tc-header" style={{ marginBottom: '0.5rem' }}>
                <div
                  className="tc-icon"
                  style={{ background: '#fffbeb', color: '#f59e0b' }}
                >
                  <i className="bi bi-bell"></i>
                </div>
              </div>
              <div className="tc-title">Notificaciones</div>
              <ul
                className="mb-0 ps-3 mt-1"
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  paddingLeft: '1rem',
                }}
              >
                <li className="mb-1">
                  Hoy: {recruiterStats.todayEvents} evento
                  {recruiterStats.todayEvents === 1 ? '' : 's'}
                </li>
                <li className="mb-1">
                  Mañana: {recruiterStats.tomorrowEvents} evento
                  {recruiterStats.tomorrowEvents === 1 ? '' : 's'}
                </li>
                <li>
                  {recruiterStats.urgentCount} vacante
                  {recruiterStats.urgentCount === 1 ? '' : 's'} urgente
                </li>
              </ul>
            </div>
          </div>

          {/* Layout Principal Scrapers y Calendario */}
          <div
            className="main-layout-modern"
            style={{ marginBottom: '1.5rem' }}
          >
            <div className="left-col-modern">
              <div className="scrapers-container-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h3 className="scrapers-container-title mb-0">
                    Vacantes urgentes (+14 días)
                  </h3>
                  <span className="badge text-bg-warning">
                    {recruiterStats.urgentCount}
                  </span>
                </div>
                {recruiterStats.urgentVacancies.length === 0 ? (
                  <div
                    className="scraper-list-item"
                    style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}
                  >
                    <div className="scraper-list-left">
                      <i
                        className="bi bi-check-circle-fill"
                        style={{ color: '#10b981', fontSize: '1.25rem' }}
                      ></i>
                      <div className="scraper-list-info">
                        <h4 style={{ color: '#065f46' }}>Todo bajo control</h4>
                        <p style={{ color: '#047857' }}>
                          No hay vacantes urgentes ahora mismo.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {recruiterStats.urgentVacancies.map((vacancy) => (
                      <div key={vacancy.id} className="scraper-list-item">
                        <div className="scraper-list-left">
                          <div className="scraper-dot error"></div>
                          <div className="scraper-list-info">
                            <h4>{vacancy.title}</h4>
                          </div>
                        </div>
                        <div className="scraper-list-right error">
                          <span>{vacancy.ageDays} días</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <SourceStatus />
              <CandidateScraperStatus />
            </div>
            <div>
              <CalendarWidget />
            </div>
          </div>

          {/* Pipeline a todo el ancho debajo de los Scrapers y el Calendario */}
          <StatsPanel stats={stats} />
        </>
      )}

      {!isBusiness && !isRecruiter && (
        <div className="tc-modern">
          <h2 className="h6 mb-2">Dashboard</h2>
          <p className="text-muted mb-0">
            No hay una vista específica configurada para tu rol.
          </p>
        </div>
      )}
    </>
  );
}
