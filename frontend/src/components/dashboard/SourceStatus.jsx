import { useState, useEffect } from 'react';
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

export default function SourceStatus() {
  const [scrapers, setScrapers] = useState(null);

  useEffect(() => {
    fetch('/api/metrics/scrapers/status')
      .then((r) => r.json())
      .then(setScrapers)
      .catch(() => setScrapers(null));
  }, []);

  if (!scrapers) return null;

  return (
    <div className="row g-3 mb-4">
      {Object.entries(scrapers).map(([key, data]) => {
        const cfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.unknown;
        const label = SCRAPER_LABELS[key] || key;
        const fecha = formatDate(data.last_extraction);

        return (
          <div className="col-12 col-md-4" key={key}>
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
                    {fecha ? `Extracción: ${fecha}` : 'Sin extracciones'}
                  </div>
                </div>
              </div>
              {data.status === 'error' && (
                <button className="btn-icon btn-icon-sm" title="Reiniciar Bot">
                  <i className="bi bi-arrow-clockwise text-danger"></i>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
