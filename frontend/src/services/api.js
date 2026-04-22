// Base del backend (VITE_API_URL); quita /api final para no duplicar rutas.
function resolveApiOrigin() {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api')) {
    base = base.slice(0, -4);
  }
  return base;
}

const BASE_URL = resolveApiOrigin();

export function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
export const ENDPOINTS = {
  auth: {
    login: `${BASE_URL}/api/auth/login`,
    register: `${BASE_URL}/api/auth/register`,
  },
  crm: {
    clientes: `${BASE_URL}/api/clients`,
    clienteDetalle: (id) => `${BASE_URL}/api/clients/${id}`,
    clienteVacantes: (id) => `${BASE_URL}/api/clients/${id}/vacants`,
  },
  recruitment: {
    candidatos: {
      list: `${BASE_URL}/api/candidates`,
      verify: (id) => `${BASE_URL}/api/candidates/${id}/verify`,
      scraperStatus: `${BASE_URL}/api/candidates/scraper-status`,
      filter: (params) => {
        const query = new URLSearchParams(params).toString();
        return `${BASE_URL}/api/candidates/filter/list?${query}`;
      },
      detail: (id) => `${BASE_URL}/api/candidates/${id}`,
      favorite: (id) => `${BASE_URL}/api/candidates/${id}/favorite`,
      bulkActions: `${BASE_URL}/api/candidates/bulk-actions`,
    },
    vacantes: {
      list: `${BASE_URL}/api/vacancies`,
      locations: `${BASE_URL}/api/vacancies/locations`,
      filter: (params) => {
        const query = new URLSearchParams(params).toString();
        return `${BASE_URL}/api/vacancies/filter/list?${query}`;
      },
      detail: (id) => `${BASE_URL}/api/vacancies/${id}`,
      favorite: (id) => `${BASE_URL}/api/vacancies/${id}/favorite`,
      bulkActions: `${BASE_URL}/api/vacancies/bulk-actions`,
    },
  },
  metrics: {
    leadStats: (fromIso, toIso) =>
      `${BASE_URL}/api/metrics?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
    scrapersStatus: `${BASE_URL}/api/metrics/scrapers/status`,
  },
  users: {
    list: `${BASE_URL}/api/users/`,
    create: `${BASE_URL}/api/users/`,
    update: (email) => `${BASE_URL}/api/users/${email}`,
    delete: (email) => `${BASE_URL}/api/users/${email}`,
  },
  calendar: {
    list: `${BASE_URL}/api/calendar/`,
    create: `${BASE_URL}/api/calendar/`,
    update: (id) => `${BASE_URL}/api/calendar/${id}`,
    delete: (id) => `${BASE_URL}/api/calendar/${id}`,
  },
};
