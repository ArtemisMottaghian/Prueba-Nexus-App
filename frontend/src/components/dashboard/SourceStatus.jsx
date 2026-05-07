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
    type: 'online',
    icon: 'bi-check-circle-fill',
    rightClass: 'success',
    statusText: 'Sistema Online',
  },
  slow: {
    type: 'warning',
    icon: 'bi-exclamation-triangle-fill',
    rightClass: 'warning',
    statusText: 'Lentitud detectada',
  },
  offline: {
    type: 'error',
    icon: 'bi-wifi-off',
    rightClass: 'error',
    statusText: 'Sin actividad reciente',
  },
  error: {
    type: 'error',
    icon: 'bi-x-circle-fill',
    rightClass: 'error',
    statusText: 'API Bloqueada',
  },
  unknown: {
    type: 'unknown',
    icon: 'bi-question-circle-fill',
    rightClass: 'unknown',
    statusText: 'Desconocido',
  },
};

function formatDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function VacancyScraperItem({ scraperKey, data }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusKey = String(data?.status || 'unknown').toLowerCase();
  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.unknown;
  const label = SCRAPER_LABELS[scraperKey] || scraperKey;

  const lastRunAt = formatDate(data?.last_run_at);
  const lastInsertion = formatDate(
    data?.last_insertion || data?.last_extraction
  );

  const runStatusKey = String(data?.last_run_status || '').toLowerCase();
  const runStatusLabel =
    runStatusKey === 'ok'
      ? 'OK'
      : runStatusKey === 'error'
        ? 'Error'
        : runStatusKey === 'timeout'
          ? 'Timeout'
          : null;

  return (
    <div
      className="scraper-list-item"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="scraper-item-header">
        <div className="scraper-list-left">
          <div className={`scraper-dot ${cfg.type}`}></div>
          <div className="scraper-list-info">
            <h4>{label}</h4>
            <p
              className={cfg.rightClass}
              style={{ fontWeight: 600, margin: 0 }}
            >
              {cfg.statusText}
            </p>
          </div>
        </div>

        <div className={`scraper-list-right ${cfg.rightClass}`}>
          {statusKey === 'error' || statusKey === 'offline' ? (
            <button
              className="scraper-action-btn"
              title="Reiniciar Bot"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#ef4444',
              }}
              onClick={(e) => {
                e.stopPropagation(); /* Aquí iría tu lógica de reiniciar */
              }}
            >
              <i
                className="bi bi-arrow-clockwise"
                style={{ fontSize: '1.25rem' }}
              ></i>
            </button>
          ) : (
            <i className={`bi ${cfg.icon}`} style={{ fontSize: '1.25rem' }}></i>
          )}
          {/* Icono de flechita para indicar que es desplegable */}
          <i
            className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-muted`}
            style={{ fontSize: '1rem' }}
          ></i>
        </div>
      </div>

      {/* Contenido Desplegable */}
      {isExpanded && (
        <div className="scraper-item-details">
          <p>
            <strong>Última ejecución:</strong> {lastRunAt || '---'}
          </p>
          <p>
            <strong>Última inserción:</strong> {lastInsertion || '---'}
          </p>
          {runStatusLabel && (
            <p>
              <strong>Estado ejecución:</strong> {runStatusLabel}
            </p>
          )}
        </div>
      )}
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
        const r = await authFetch(ENDPOINTS.metrics.scrapersStatus);
        const data = await r.json();
        if (!cancelled) setScrapers(data);
      } catch (e) {
        console.error(
          'Error al cargar el estado de los scrapers de vacantes:',
          e
        );
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

  if (loading) return null;
  if (!scrapers || Object.keys(scrapers).length === 0) return null;

  return (
    <div className="scrapers-container-card">
      <h3 className="scrapers-container-title">Scrapers de vacantes</h3>
      <div>
        {Object.entries(scrapers).map(([key, data]) => (
          <VacancyScraperItem key={key} scraperKey={key} data={data} />
        ))}
      </div>
    </div>
  );
}
