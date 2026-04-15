/**
 * Origen del backend (host + puerto), sin /api final.
 * Las rutas abajo ya incluyen /api/...
 * Si VITE_API_URL lleva .../api al final, se normaliza para evitar /api/api/...
 */
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
  },
  users: {
    list: `${BASE_URL}/api/users/`,
    create: `${BASE_URL}/api/users/`,
    update: (email) => `${BASE_URL}/api/users/${email}`,
    delete: (email) => `${BASE_URL}/api/users/${email}`,
  },
};
