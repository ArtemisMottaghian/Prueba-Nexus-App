import './SourceOriginBadge.css';

// Minúsculas y sin tildes para reconocer bien el portal
function normalizeSource(source) {
  return String(source ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Por ahora solo mostramos badge para InfoJobs; el resto, nada
export default function SourceOriginBadge({ source }) {
  const key = normalizeSource(source);
  if (key !== 'infojobs') return null;

  const label = source?.trim() ? source : 'InfoJobs';

  return (
    <div className="origin-badge">
      <i className="bi bi-window-stack" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
