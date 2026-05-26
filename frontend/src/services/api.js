// ============================================
// api.js - Configuración de Endpoints (NexusAI)
// ============================================
function resolveApiOrigin() {
  const raw = import.meta.env.VITE_API_URL || 'http://nexus.ara-tech.es:8000';
  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api')) {
    base = base.slice(0, -4);
  }
  return base;
}

const BASE_URL = resolveApiOrigin();

export function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export const ENDPOINTS = {
  auth: {
    login: `${BASE_URL}/api/login`,
    logout: `${BASE_URL}/api/login/logout`,
    googleLogin: `${BASE_URL}/api/login/google/login`,
    googleCallback: `${BASE_URL}/api/login/google/callback`,
    register: `${BASE_URL}/api/auth/register`,
    forgotPassword: `${BASE_URL}/api/login/forgot-password`,
    resetPassword: `${BASE_URL}/api/login/reset-password`,
    changePassword: `${BASE_URL}/api/login/change-password`,
  },
  companies: {
    list: `${BASE_URL}/api/companies/clientes`,
    detail: (id) => `${BASE_URL}/api/companies/${id}`,
    create: `${BASE_URL}/api/companies`,
    update: (id) => `${BASE_URL}/api/companies/${id}`,
    delete: (id) => `${BASE_URL}/api/companies/${id}`,
    assignedTo: (userId) => `${BASE_URL}/api/companies/assigned/${userId}`,
    assignUser: `${BASE_URL}/api/companies/assign-user`,
    comments: (id) => `${BASE_URL}/api/companies/${id}/comments`,
    updateComment: (commentId) =>
      `${BASE_URL}/api/companies/comments/${commentId}`,
    vacancies: (id) => `${BASE_URL}/api/companies/${id}/vacants`,
  },

  recruitment: {
    candidatos: {
      list: `${BASE_URL}/api/candidates`,
      processCV: `${BASE_URL}/api/candidates/process_cv`,
      detail: (id) => `${BASE_URL}/api/candidates/${id}`,
      updateStatus: (id) => `${BASE_URL}/api/candidates/${id}/status`,
      delete: (id) => `${BASE_URL}/api/candidates/${id}`,
      verify: (id) => `${BASE_URL}/api/candidates/${id}/verify`,
      scraperStatus: `${BASE_URL}/api/candidates/scraper-status`,
      filter: (params) => {
        const query = new URLSearchParams(params).toString();
        return `${BASE_URL}/api/candidates/filter/list?${query}`;
      },
      favourite: (id) => `${BASE_URL}/api/candidates/${id}/favourite`,
      bulkActions: `${BASE_URL}/api/candidates/bulk-actions`,
      search: (name) =>
        `${BASE_URL}/api/candidates/search?name=${encodeURIComponent(name)}`,
      locations: `${BASE_URL}/api/candidates/locations`,
    },
    vacantes: {
      list: `${BASE_URL}/api/vacancies`,
      assignedTo: (hrId) => `${BASE_URL}/api/vacancies/assigned/${hrId}`,
      locations: `${BASE_URL}/api/vacancies/locations`,
      filter: (params) => {
        const query = new URLSearchParams(params).toString();
        return `${BASE_URL}/api/vacancies/filter/list?${query}`;
      },
      detail: (id) => `${BASE_URL}/api/vacancies/${id}`,
      public: (id) => `${BASE_URL}/api/vacancies/public/${id}`,
      favourite: (id) => `${BASE_URL}/api/vacancies/${id}/favourite`,
      bulkActions: `${BASE_URL}/api/vacancies/bulk-actions`,
      updateStatus: (id) => `${BASE_URL}/api/vacancies/${id}/status`,
      assignHr: `${BASE_URL}/api/vacancies/assign-hr`,
      unassignHr: (hrId, vacancyIds) =>
        `${BASE_URL}/api/vacancies/unassign-hr/${hrId}/${vacancyIds}`,
      notes: (id) => `${BASE_URL}/api/vacancies/${id}/notes`,
      updateNote: (id, noteId) =>
        `${BASE_URL}/api/vacancies/${id}/notes/${noteId}`,
      candidateTracking: (id) =>
        `${BASE_URL}/api/vacancies/${id}/candidate-tracking`,
      applications: (id) => `${BASE_URL}/api/vacancies/${id}/applications`,
    },
  },

  ai: {
    matchVacancy: (vacancyId) =>
      `${BASE_URL}/api/ai/match-vacancy/${vacancyId}`,
  },

  metrics: {
    general: `${BASE_URL}/api/metrics`,
    candidatesStatus: `${BASE_URL}/api/metrics/candidates/status`,
    leadStats: (fromIso, toIso) => {
      const from = encodeURIComponent(fromIso);
      const to = encodeURIComponent(toIso);
      return `${BASE_URL}/api/metrics?from=${from}&to=${to}&start=${from}&end=${to}`;
    },
    scrapersStatus: `${BASE_URL}/api/metrics/scrapers/status`,
  },

  users: {
    list: `${BASE_URL}/api/users`,
    create: `${BASE_URL}/api/users`,
    detail: (email) => `${BASE_URL}/api/users/${email}`,
    update: (email) => `${BASE_URL}/api/users/${email}`,
    delete: (email) => `${BASE_URL}/api/users/${email}`,
    me: `${BASE_URL}/api/users/me`,
    notifications: `${BASE_URL}/api/users/me/notifications`,
  },

  calendar: {
    list: `${BASE_URL}/api/calendar/`,
    create: `${BASE_URL}/api/calendar/`,
    update: (id) => `${BASE_URL}/api/calendar/${id}`,
    delete: (id) => `${BASE_URL}/api/calendar/${id}`,
  },

  chat: {
    list: `${BASE_URL}/api/conversations`,
    create: `${BASE_URL}/api/conversations`,
    messages: (convId) => `${BASE_URL}/api/conversations/${convId}/messages`,
    send: (convId) => `${BASE_URL}/api/conversations/${convId}/messages`,
    markRead: (convId) => `${BASE_URL}/api/conversations/${convId}/read`,
    offline: `${BASE_URL}/api/conversations/offline`,
    deleteMessage: (convId, msgId) =>
      `${BASE_URL}/api/conversations/${convId}/messages/${msgId}`,
    editMessage: (convId, msgId) =>
      `${BASE_URL}/api/conversations/${convId}/messages/${msgId}`,
    unread: `${BASE_URL}/api/conversations/unread`,
    archive: (convId) => `${BASE_URL}/api/conversations/${convId}/archive`,
    stream: `${BASE_URL}/api/conversations/stream`,
    typing: (convId) => `${BASE_URL}/api/conversations/${convId}/typing`,
  },
};
