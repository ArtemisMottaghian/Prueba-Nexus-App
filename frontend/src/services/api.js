const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const ENDPOINTS = {
  auth: {
    login: `${BASE_URL}/auth/login`,
    register: `${BASE_URL}/auth/register`,
  },
  crm: {
    clientes: `${BASE_URL}/clients`,
    clienteDetalle: (id) => `${BASE_URL}/clients/${id}`,
    clienteVacantes: (id) => `${BASE_URL}/clients/${id}/vacants`,
  },
  recruitment: {
    candidatos: `${BASE_URL}/candidatos`,
    vacantes: {
      // 1. Obtener todas
      list: `${BASE_URL}/api/vacancies`,

      // 2. Filtrar
      filter: (params) => {
        const query = new URLSearchParams(params).toString();
        return `${BASE_URL}/api/vacancies/filter/list?${query}`;
      },
      // 3. Detalle de una sola
      detail: (id) => `${BASE_URL}/api/vacancies/${id}`,

      // 4. Marcar favorito
      favorite: (id) => `${BASE_URL}/api/vacancies/${id}/favorite`,

      // 5. Acciones masivas
      bulkActions: `${BASE_URL}/api/vacancies/bulk-actions`,
    },
  },
};