import './SourceOriginBadge.css';

function normalizeSource(source) {
  return String(source ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const SOURCE_CONFIG = {
  infojobs: {
    label: 'InfoJobs',
    icon: 'bi-briefcase',
    className: 'origin-badge--infojobs',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'bi-linkedin',
    className: 'origin-badge--linkedin',
  },
  adzuna: {
    label: 'Adzuna',
    icon: 'bi-search',
    className: 'origin-badge--adzuna',
  },
  'github api': {
    label: 'GitHub',
    icon: 'bi-github',
    className: 'origin-badge--github',
  },
  github: {
    label: 'GitHub',
    icon: 'bi-github',
    className: 'origin-badge--github',
  },
  'carga manual': {
    label: 'Manual',
    icon: 'bi-pencil-square',
    className: 'origin-badge--manual',
  },
  manual: {
    label: 'Manual',
    icon: 'bi-pencil-square',
    className: 'origin-badge--manual',
  },
};

export default function SourceOriginBadge({ source }) {
  const key = normalizeSource(source);
  const config = SOURCE_CONFIG[key];

  if (!config) {
    // Origen desconocido pero existente — mostrar genérico
    if (!source) return null;
    return (
      <div className="origin-badge origin-badge--generic">
        <i className="bi bi-window-stack" aria-hidden />
        <span>{source}</span>
      </div>
    );
  }

  return (
    <div className={`origin-badge ${config.className}`}>
      <i className={`bi ${config.icon}`} aria-hidden />
      <span>{config.label}</span>
    </div>
  );
}
