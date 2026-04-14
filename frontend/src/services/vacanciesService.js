import { ENDPOINTS, authFetch } from './api';

const getPortalName = (id) => {
  const numId = Number(id);

  if (numId === 1) return 'LinkedIn';
  if (numId === 2) return 'InfoJobs';
  if (numId === 3) return 'Adzuna';
  return 'Otro';
};

const mapVacancyData = (v) => ({
  id: v.id,
  title: v.title,
  companyName: v.company_name,
  industry: v.sector || 'N/A',
  location: v.location || 'No especificada',
  status: v.status,
  source: getPortalName(v.portal_id),
  // Convertimos la fecha de Python a algo legible
  time: v.published_at
    ? new Date(v.published_at).toLocaleDateString()
    : 'Sin fecha',
  rawDate: v.published_at || v.scraped_at || null,
  description: v.job_description,
  salaryMin: v.salary_min,
  salaryMax: v.salary_max,
});

export const vacanciesService = {
  // 1. Obtener todas las vacantes
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
};
