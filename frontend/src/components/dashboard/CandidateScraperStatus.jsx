import { useState, useEffect } from 'react';
import { ENDPOINTS, authFetch } from '../../services/api';
import './SourceStatus.css';
import './CandidateScraperStatus.css';

const STATUS_CONFIG = {
  online: {
    cls: 'status-success',
    iconCls: 'bg-success-soft',
    icon: 'bi-check-circle-fill',
    textCls: 'text-success',
    label: 'Sistema Online',
  },
  error: {
    cls: 'status-danger',
    iconCls: 'bg-danger-soft',
    icon: 'bi-x-circle-fill',
    textCls: 'text-danger',
    label: 'Ultima ejecucion con error',
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

function formatCount(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-ES').format(n);
}

export default function CandidateScraperStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authFetch(ENDPOINTS.metrics.candidatesStatus);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        console.error('Candidate scraper status:', e);
        if (!cancelled) {
          setError('No se pudo cargar el estado de los scrapers.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="candidate-scraper-status candidate-scraper-status--loading mb-4">
        <h3 className="candidate-scraper-status__title h6 fw-semibold mb-3">
          Scrapers de candidatos
        </h3>
        <p className="text-muted small mb-0">
          Cargando estado de scrapers de candidatos…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="candidate-scraper-status mb-4">
        <h3 className="candidate-scraper-status__title h6 fw-semibold mb-3">
          Scrapers de candidatos
        </h3>
        <p className="text-danger small mb-0">{error}</p>
      </section>
    );
  }

  const scrapers = Array.isArray(data?.scrapers)
    ? data.scrapers
    : data && typeof data === 'object'
      ? Object.entries(data).map(([key, item]) => ({
          name: item?.name || key,
          ...item,
        }))
      : [];
  if (scrapers.length === 0) {
    return (
      <section className="candidate-scraper-status mb-4">
        <h3 className="candidate-scraper-status__title h6 fw-semibold mb-3">
          Scrapers de candidatos
        </h3>
        <p className="text-muted small mb-0">
          No hay datos de scrapers de candidatos.
        </p>
      </section>
    );
  }

  return (
    <section className="candidate-scraper-status mb-4">
      <h3 className="candidate-scraper-status__title h6 fw-semibold mb-3">
        Scrapers de candidatos
      </h3>
      <div className="row g-3">
        {scrapers.map((item) => {
          const statusKey = String(item.status || '').toLowerCase();
          const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.unknown;
          const fecha = formatDate(item.last_insertion || item.last_extraction);
          const total = item.candidates_today ?? item.total_candidates;

          return (
            <div className="col-12 col-md-4" key={item.name}>
              <div className={`source-card ${cfg.cls}`}>
                <div className="d-flex align-items-center">
                  <div className={`source-icon-wrapper ${cfg.iconCls}`}>
                    <i className={`bi ${cfg.icon}`}></i>
                  </div>
                  <div className="source-info flex-grow-1 min-w-0">
                    <h6 className="text-body mb-0">{item.name}</h6>
                    <span
                      className={`source-status-text ${cfg.textCls} d-block`}
                    >
                      {cfg.label}
                    </span>
                    <div className="text-muted candidate-scraper-status__meta">
                      {fecha
                        ? `Inserción: ${fecha}`
                        : 'Sin inserciones registradas'}
                    </div>
                    <div className="text-muted candidate-scraper-status__meta">
                      Candidatos hoy: {formatCount(total)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
