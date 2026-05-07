import { useState, useEffect } from 'react';
import { ENDPOINTS, authFetch } from '../../services/api';
import './SourceStatus.css';

const STATUS_CONFIG = {
  online: {
    type: 'online',
    icon: 'bi-check-circle-fill',
    rightClass: 'success',
    text: 'Sistema Online',
  },
  error: {
    type: 'error',
    icon: 'bi-x-circle-fill',
    rightClass: 'error',
    text: 'Desconocido / Error',
  },
  unknown: {
    type: 'unknown',
    icon: 'bi-question-circle-fill',
    rightClass: 'unknown',
    text: 'Desconocido',
  },
};

function formatDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function formatCount(n) {
  if (n == null || Number.isNaN(n)) return '0';
  return new Intl.NumberFormat('es-ES').format(n);
}

// Subcomponente para gestionar el estado desplegable de cada candidato
function CandidateScraperItem({ item }) {
  const [isExpanded, setIsExpanded] = useState(false);

  let statusKey = String(item.status || 'unknown').toLowerCase();
  const fecha = formatDate(item.last_insertion || item.last_extraction);
  const total = item.candidates_today ?? item.total_candidates;

  // Si el backend no manda status pero tenemos datos o fecha, forzamos online
  if ((statusKey === 'unknown' || statusKey === '') && (total > 0 || fecha)) {
    statusKey = 'online';
  }

  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.unknown;

  return (
    <div
      className="scraper-list-item"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="scraper-item-header">
        {/* Lado izquierdo: Puntito, Título y Texto de estado */}
        <div className="scraper-list-left">
          <div className={`scraper-dot ${cfg.type}`}></div>
          <div className="scraper-list-info">
            <h4>{item.name}</h4>
            <p
              className={cfg.rightClass}
              style={{ fontWeight: 600, margin: 0 }}
            >
              {cfg.text}
            </p>
          </div>
        </div>

        {/* Lado derecho: Icono de estado y Flechita */}
        <div className={`scraper-list-right ${cfg.rightClass}`}>
          <i className={`bi ${cfg.icon}`} style={{ fontSize: '1.25rem' }}></i>
          <i
            className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-muted`}
            style={{ fontSize: '1rem', marginLeft: '0.5rem' }}
          ></i>
        </div>
      </div>

      {/* Contenido Desplegable */}
      {isExpanded && (
        <div className="scraper-item-details">
          <p>
            <strong>Inserción:</strong>{' '}
            {fecha ? fecha : 'Sin inserciones registradas'}
          </p>
          <p>
            <strong>Candidatos hoy:</strong>{' '}
            {total != null ? formatCount(total) : '0'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function CandidateScraperStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(ENDPOINTS.metrics.candidatesStatus);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        console.error('Error al cargar el estado de los candidatos:', e);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const scrapers = Array.isArray(data?.scrapers)
    ? data.scrapers
    : data && typeof data === 'object'
      ? Object.entries(data).map(([key, item]) => ({
          name: item?.name || key,
          ...item,
        }))
      : [];

  if (scrapers.length === 0) return null;

  return (
    <div className="scrapers-container-card">
      <h3 className="scrapers-container-title">Scrapers de Candidatos</h3>
      <div>
        {scrapers.map((item) => (
          <CandidateScraperItem key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}
