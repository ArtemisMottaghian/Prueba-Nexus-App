import { ENDPOINTS, authFetch } from './api';

const mapCandidateData = (c) => ({
  id: c.id,
  name: c.name,
  specialty: c.specialty || 'N/A',
  location: c.location || 'Remoto',
  status: c.status,
  source: c.source || 'N/A',
  experience: c.experience || 'N/A',
  isAvailable: c.is_available ?? c.isAvailable ?? false,
  isFavorite: c.is_favorite ?? c.isFavorite ?? false,
  time: c.created_at
    ? new Date(c.created_at).toLocaleDateString()
    : c.time || 'Reciente',
});

export const candidatesService = {
  getAllCandidates: async () => {
    try {
      const response = await authFetch(ENDPOINTS.recruitment.candidatos.list);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return data.map(mapCandidateData);
    } catch (error) {
      console.error('Error al obtener la lista de candidatos:', error);
      throw error;
    }
  },

  getFilteredCandidates: async (params) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.filter(params)
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return data.map(mapCandidateData);
    } catch (error) {
      console.error('Error al filtrar candidatos:', error);
      throw error;
    }
  },

  getCandidateById: async (id) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.detail(id)
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return mapCandidateData(data);
    } catch (error) {
      console.error(`Error al obtener detalle del candidato ${id}:`, error);
      throw error;
    }
  },

  toggleFavorite: async (id, isFavorite) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.favorite(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorite: isFavorite }),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al cambiar favorito del candidato ${id}:`, error);
      throw error;
    }
  },

  applyBulkActions: async (candidateIds, actionName) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.bulkActions,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate_ids: candidateIds,
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
