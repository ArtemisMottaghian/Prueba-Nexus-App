/** Valores de `CandidateStatus` en el API (GET/PATCH). */
export const CANDIDATE_STATUS_OPTIONS = [
  { value: 'active', label: 'En búsqueda activa' },
  { value: 'passive', label: 'Abierto a ofertas' },
  { value: 'hired_elsewhere', label: 'Contratado (otra empresa)' },
  { value: 'hired', label: 'Contratado (por nosotros)' },
  { value: 'blacklisted', label: 'No contactar' },
];

/** Incluye etiquetas antiguas (mock / candidatesData.json) para que el select muestre valor. */
export const CANDIDATE_STATUS_SELECT_OPTIONS = [
  ...CANDIDATE_STATUS_OPTIONS,
  { value: 'Nuevo', label: 'Nuevo' },
  { value: 'Contactado', label: 'Contactado' },
  { value: 'En proceso', label: 'En proceso' },
  { value: 'Descartado', label: 'Descartado' },
];

const LABELS = Object.fromEntries(
  CANDIDATE_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

/** Texto amigable para el badge; admite datos antiguos / mock. */
export function candidateStatusLabel(status) {
  return LABELS[status] || status;
}

export function candidateStatusBadgeClass(status) {
  switch (status) {
    case 'active':
    case 'Nuevo':
      return 'badge-nueva';
    case 'passive':
    case 'Contactado':
      return 'badge-contactada';
    case 'hired':
      return 'badge-contratada';
    case 'hired_elsewhere':
    case 'En proceso':
      return 'badge-en-proceso';
    case 'blacklisted':
    case 'Descartado':
      return 'badge-descartada';
    default:
      return 'badge-nueva';
  }
}
