const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const ENDPOINTS = {
  auth: {
    login: `${BASE_URL}/auth/login`,
    register: `${BASE_URL}/auth/register`,
  },
  crm: {
    clientes: `${BASE_URL}/clientes`,
    clienteDetalle: (id) => `${BASE_URL}/clientes/${id}`,
  },
  recruitment: {
    vacantes: `${BASE_URL}/vacantes`,
    candidatos: `${BASE_URL}/candidatos`,
  },
};
