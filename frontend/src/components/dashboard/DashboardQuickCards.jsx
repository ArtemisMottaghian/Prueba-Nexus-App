import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import './DashboardQuickCards.css';

const PERIOD_LABELS = {
  day: 'Hoy',
  week: 'Últimos 7 días',
  month: 'Últimos 30 días',
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

  return (
    <div className="row g-3 mb-4">
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="dashboard-quick-card">
          <div className="dashboard-quick-card__icon dashboard-quick-card__icon--purple">
            <i className="bi bi-lightning-charge-fill"></i>
          </div>
          <div className="flex-grow-1 min-w-0">
            <div
              className="text-muted small text-uppercase"
              style={{ letterSpacing: '0.04em' }}
            >
              Resumen del periodo
            </div>
            <div
              className="fs-3 fw-bold text-white mb-0"
              style={{ lineHeight: 1.2 }}
            >
              {loading ? '—' : pipelineTotal}
            </div>
            <div className="small text-muted">{periodLabel}</div>
            <div className="small text-muted mt-1">
              Vacantes en pipeline (nuevas + contactadas + en proceso)
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-sm-6 col-xl-3">
        <Link
          to="/vacantes"
          className="text-decoration-none text-reset d-block h-100"
        >
          <div className="dashboard-quick-card dashboard-quick-card--link h-100">
            <div className="dashboard-quick-card__icon dashboard-quick-card__icon--cyan">
              <i className="bi bi-briefcase"></i>
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="fw-semibold text-white mb-1">Vacantes</div>
              <div className="small text-muted">Directorio y filtros</div>
              <div className="small text-primary mt-2 mb-0">
                Ir <i className="bi bi-arrow-right-short"></i>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="col-12 col-sm-6 col-xl-3">
        <Link
          to="/clientes"
          className="text-decoration-none text-reset d-block h-100"
        >
          <div className="dashboard-quick-card dashboard-quick-card--link h-100">
            <div className="dashboard-quick-card__icon dashboard-quick-card__icon--violet">
              <i className="bi bi-building"></i>
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="fw-semibold text-white mb-1">Clientes</div>
              <div className="small text-muted">CRM y detalle</div>
              <div className="small text-primary mt-2 mb-0">
                Ir <i className="bi bi-arrow-right-short"></i>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="col-12 col-sm-6 col-xl-3">
        <Link
          to="/candidatos"
          className="text-decoration-none text-reset d-block h-100"
        >
          <div className="dashboard-quick-card dashboard-quick-card--link h-100">
            <div className="dashboard-quick-card__icon dashboard-quick-card__icon--amber">
              <i className="bi bi-people"></i>
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="fw-semibold text-white mb-1">Candidatos</div>
              <div className="small text-muted">Listado y selección</div>
              <div className="small text-primary mt-2 mb-0">
                Ir <i className="bi bi-arrow-right-short"></i>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
