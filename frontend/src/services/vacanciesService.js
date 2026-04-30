import { ENDPOINTS, authFetch } from './api';

const getPortalName = (id) => {
  const numId = Number(id);

  if (numId === 1) return 'LinkedIn';
  if (numId === 2) return 'InfoJobs';
  if (numId === 3) return 'Adzuna';
  return 'Otro';
};

const translateStatusToUI = (dbStatus) => {
  if (!dbStatus) return 'Nueva';

  const statusMap = {
    detected: 'Nueva',
    contacted: 'Contactada',
    negotiating: 'En proceso',
    won: 'Ganada',
    discarded: 'Descartada',
  };

  return statusMap[dbStatus.toLowerCase()] || dbStatus;
};

const mapVacancyData = (v) => {
  const translatedStatus = translateStatusToUI(v.status);

  return {
    id: v.id,
    title: v.title,
    companyName: v.company_name,
    company_id: v.company_id,
    industry: v.sector || 'N/A',
    location: v.location || 'No especificada',
    status: translatedStatus,
    source: getPortalName(v.portal_id),
    isFavourite: v.is_favourite || false,
    time: v.published_at
      ? new Date(v.published_at).toLocaleDateString()
      : 'Sin fecha',
    rawDate: v.published_at || v.scraped_at || null,
    description: v.job_description,
    salaryMin: v.salary_min,
    salaryMax: v.salary_max,
    assignedTo: v.assigned_recruiters
      ? v.assigned_recruiters.map((r) => ({
          id: r.id,
          nombre: r.name || r.nombre || r.email?.split('@')[0] || 'Usuario',
          email: r.email,
          fecha: r.created_at
            ? new Date(r.created_at).toLocaleDateString('es-ES')
            : new Date().toLocaleDateString('es-ES'),
        }))
      : [],
  };
};

export const vacanciesService = {
  // 1. Obtener localizaciones únicas
  getLocations: async () => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.locations
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error al obtener localizaciones:', error);
      return [];
    }
  },

  // 2. Obtener todas las vacantes
  getAllVacancies: async () => {
    try {
      const response = await authFetch(ENDPOINTS.recruitment.vacantes.list);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      // Mapeamos cada vacante para que los nombres coincidan
      return data.map(mapVacancyData);
    } catch (error) {
      console.error('Error al obtener la lista de vacantes:', error);
      throw error;
    }
  },

  // 2b. Obtener vacantes asignadas a un reclutador
  getAssignedVacancies: async (hrId) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.assignedTo(hrId)
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return data.map(mapVacancyData);
    } catch (error) {
      console.error(
        `Error al obtener vacantes asignadas para reclutador ${hrId}:`,
        error
      );
      throw error;
    }
  },

  // 3. Filtrar vacantes
  getFilteredVacancies: async (params) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.filter(params)
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return data.map(mapVacancyData);
    } catch (error) {
      console.error('Error al filtrar vacantes:', error);
      throw error;
    }
  },

  getVacancyById: async (id) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.detail(id)
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();

      return mapVacancyData(data);
    } catch (error) {
      console.error(`Error al obtener detalle de la vacante ${id}:`, error);
      throw error;
    }
  },

  toggleFavorite: async (id, isFavourite) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.favourite(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favourite: isFavourite }),
        }
      );

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al cambiar favorito de vacante ${id}:`, error);
      throw error;
    }
  },

  applyBulkActions: async (vacancyIds, actionName, targetUser = null) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.bulkActions,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacancy_ids: vacancyIds,
            action: actionName,
            target_user: targetUser,
          }),
        }
      );

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al aplicar acción masiva ${actionName}:`, error);
      throw error;
    }
  },

  // 7. Actualizar el estado de una vacante de forma individual
  updateVacancyStatus: async (id, newStatus) => {
    const statusMap = {
      nueva: 'detected',
      contactada: 'contacted',
      'en proceso': 'negotiating',
      en_proceso: 'negotiating',
      descartada: 'discarded',
      ganada: 'won',
    };
    // Si viene del backend (ej: "detected"), lo pasamos tal cual.
    // Si viene del frontend (ej: "Nueva"), lo traducimos.
    const rawStatus = String(newStatus).toLowerCase().trim();
    const backendStatus = statusMap[rawStatus] || rawStatus;

    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.updateStatus(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: backendStatus }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Error ${response.status}: No se pudo actualizar el estado de la vacante`
        );
      }
      return await response.json();
    } catch (error) {
      console.error(
        'Error al actualizar el estado individual de la vacante:',
        error
      );
      throw error;
    }
  },

  // 8. Actualizar datos completos de una vacante
  updateVacancy: async (id, data) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.detail(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al actualizar vacante ${id}:`, error);
      throw error;
    }
  },

  // 9. Añadir nota al historial de una vacante
  addNote: async (id, texto) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.detail(id) + '/notes',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto }),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al añadir nota a vacante ${id}:`, error);
      throw error;
    }
  },

  // Editar una nota existente
  updateNote: async (id, noteId, texto) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.detail(id) + `/notes/${noteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto }),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(
        `Error al actualizar nota ${noteId} de vacante ${id}:`,
        error
      );
      throw error;
    }
  },

  // Eliminar una nota
  deleteNote: async (id, noteId) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.detail(id) + `/notes/${noteId}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      // DELETE suele responder 204 sin cuerpo
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      console.error(
        `Error al eliminar nota ${noteId} de vacante ${id}:`,
        error
      );
      throw error;
    }
  },

  assignHr: async (hrId, vacancyIds) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.assignHr,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hr_id: hrId, vacancy_ids: vacancyIds }),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al asignar RRHH a vacantes:`, error);
      throw error;
    }
  },

  unassignHr: async (hrId, vacancyIds) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.assignHr,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hr_id: hrId, vacancy_ids: vacancyIds }),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al desasignar RRHH de vacantes:`, error);
      throw error;
    }
  },

  getSmartMatch: async (vacancyId) => {
    try {
      const response = await authFetch(ENDPOINTS.ai.matchVacancy(vacancyId));
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return data.candidates || []; // Adjust based on your actual response structure
    } catch (error) {
      console.error(
        `Error al obtener Smart Match para vacante ${vacancyId}:`,
        error
      );
      throw error;
    }
  },
};
