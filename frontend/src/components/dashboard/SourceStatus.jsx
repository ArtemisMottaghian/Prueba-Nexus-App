import { useState, useEffect } from 'react';
import { ENDPOINTS, authFetch } from '../../services/api';
import './SourceStatus.css';

const SCRAPER_LABELS = {
  adzuna: 'Adzuna (API)',
  infojobs: 'InfoJobs',
  linkedin: 'LinkedIn (Bot)',
};

const STATUS_CONFIG = {
  online: {
    cls: 'status-success',
    iconCls: 'bg-success-soft',
    icon: 'bi-check-circle-fill',
    textCls: 'text-success',
    label: 'Sistema Online',
  },
  slow: {
    cls: 'status-warning',
    iconCls: 'bg-warning-soft',
    icon: 'bi-exclamation-triangle-fill',
    textCls: 'text-warning',
    label: 'Lentitud detectada',
  },
  offline: {
    cls: 'status-danger',
    iconCls: 'bg-danger-soft',
    icon: 'bi-wifi-off',
    textCls: 'text-danger',
    label: 'Sin actividad reciente',
  },
  warning: {
    cls: 'status-warning',
    iconCls: 'bg-warning-soft',
    icon: 'bi-exclamation-triangle-fill',
    textCls: 'text-warning',
    label: 'Lentitud detectada',
  },
  error: {
    cls: 'status-danger',
    iconCls: 'bg-danger-soft',
    icon: 'bi-x-circle-fill',
    textCls: 'text-danger',
    label: 'API Bloqueada',
  },
  unknown: {
    cls: 'status-secondary',
    iconCls: 'bg-secondary-soft',
    icon: 'bi-question-circle-fill',
    textCls: 'text-muted',
    label: 'Desconocido',
  },
};

function formatDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function VacancyScraperCard({ scraperKey, data }) {
  const statusKey = String(data?.status || '').toLowerCase();
  const runStatusKey = String(data?.last_run_status || '').toLowerCase();
  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.unknown;
  const label = SCRAPER_LABELS[scraperKey] || scraperKey;
  const lastRunAt = formatDate(data.last_run_at);
  const lastInsertion = formatDate(data.last_insertion || data.last_extraction);
  const runStatusLabel =
    runStatusKey === 'ok'
      ? 'OK'
      : runStatusKey === 'error'
        ? 'Error'
        : runStatusKey === 'timeout'
          ? 'Timeout'
          : null;

  return (
    <div className="col-12 col-md-4">
      <div className={`source-card ${cfg.cls} justify-content-between`}>
        <div className="d-flex align-items-center">
          <div className={`source-icon-wrapper ${cfg.iconCls}`}>
            <i className={`bi ${cfg.icon}`}></i>
          </div>
          <div className="source-info">
            <h6 className="text-body">{label}</h6>
            <span className={`source-status-text ${cfg.textCls}`}>
              {cfg.label}
            </span>
            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
              {lastRunAt
                ? `Última ejecución: ${lastRunAt}`
                : 'Sin ejecución reciente'}
            </div>
            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
              {lastInsertion
                ? `Última inserción: ${lastInsertion}`
                : 'Sin inserciones registradas'}
            </div>
            {runStatusLabel && (
              <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                Estado ejecución: {runStatusLabel}
              </div>
            )}
          </div>
        </div>
        {(statusKey === 'error' || statusKey === 'offline') && (
          <button className="btn-icon btn-icon-sm" title="Reiniciar Bot">
            <i className="bi bi-arrow-clockwise text-danger"></i>
          </button>
        )}
      </div>
    </div>
  );
}

export default function SourceStatus() {
  const [scrapers, setScrapers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const r = await authFetch(ENDPOINTS.metrics.scrapersStatus);
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          throw new Error('Non-JSON response');
        }
        const data = await r.json();
        if (!cancelled) setScrapers(data);
      } catch (e) {
        console.error('Scrapers de vacantes:', e);
        if (!cancelled) setScrapers(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="source-status-section mb-4">
        <h3 className="source-status-section__title h6 fw-semibold mb-3">
          Scrapers de vacantes
        </h3>
        <p className="text-muted small mb-0">Cargando estado de scrapers...</p>
      </section>
    );
  }

  if (!scrapers || Object.keys(scrapers).length === 0) {
    return (
      <section className="source-status-section mb-4">
        <h3 className="source-status-section__title h6 fw-semibold mb-3">
          Scrapers de vacantes
        </h3>
        <p className="text-muted small mb-0">
          No hay datos de scrapers de vacantes.
        </p>
      </section>
    );
  }

  return (
    <section className="source-status-section mb-4">
      <h3 className="source-status-section__title h6 fw-semibold mb-3">
        Scrapers de vacantes
      </h3>
      <div className="row g-3">
        {Object.entries(scrapers).map(([key, data]) => (
          <VacancyScraperCard key={key} scraperKey={key} data={data} />
        ))}
      </div>
    </section>
  );
}
