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
    industry: v.sector || 'N/A',
    location: v.location || 'No especificada',
    status: translatedStatus,
    source: getPortalName(v.portal_id),
    isFavorite: v.is_favorite || false,
    time: v.published_at
      ? new Date(v.published_at).toLocaleDateString()
      : 'Sin fecha',
    rawDate: v.published_at || v.scraped_at || null,
    description: v.job_description,
    salaryMin: v.salary_min,
    salaryMax: v.salary_max,
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

  // 2. Filtrar vacantes
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

  // 3. Ver detalle de una vacante
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

  // 4. Marcar/Desmarcar favorito
  toggleFavorite: async (id, isFavorite) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.favorite(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorite: isFavorite }),
        }
      );

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al cambiar favorito de vacante ${id}:`, error);
      throw error;
    }
  },

  // 5. Acciones masivas
  applyBulkActions: async (vacancyIds, actionName) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.vacantes.bulkActions,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacancy_ids: vacancyIds,
            action: actionName,
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

  // Actualizar el estado de una vacante
  updateVacancyStatus: async (id, newStatus) => {
    const response = await authFetch(
      ENDPOINTS.recruitment.vacantes.detail(id) + '/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }
    );
    if (!response.ok)
      throw new Error('Error al actualizar el estado de la vacante');
    return response.json();
  },

  // Actualizar datos completos de una vacante
  updateVacancy: async (id, data) => {
    try {
      const response = await authFetch(ENDPOINTS.recruitment.vacantes.detail(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al actualizar vacante ${id}:`, error);
      throw error;
    }
  },

  // Añadir nota al historial de una vacante
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
};
