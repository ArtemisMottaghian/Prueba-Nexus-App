export default function Badge({ type = 'nueva', label }) {
  const classes = {
    nueva:      'badge-nueva',
    contactada: 'badge-contactada',
    'en proceso': 'badge-en-proceso',
    descartada: 'badge-descartada',
    cliente:    'badge-client',
  };

  const badgeClass = classes[type?.toLowerCase()] || 'badge-nueva';
  const text = label || type;

  return (
    <span className={`badge ${badgeClass}`}>
      {text}
    </span>
  );
}