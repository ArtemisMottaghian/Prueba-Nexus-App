import { ENDPOINTS, authFetch } from './api';

// Construye el nombre completo evitando palabras repetidas.
// Soluciona la duplicación del nombre cuando el parseo del CV deja el nombre completo tanto en first_name como en last_name.
const buildFullName = (c) => {
  const raw =
    c.name && c.name.trim()
      ? c.name.trim()
      : `${c.first_name || ''} ${c.last_name || ''}`.trim();
  const seen = new Set();
  return raw
    .split(/\s+/)
    .filter((word) => {
      if (!word) return false;
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' ');
};

// Formatea la fecha con "/" (ej. 8/4/2026)
const formatFecha = (raw) => {
  if (!raw) return 'Reciente';
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? String(raw).replaceAll('-', '/')
    : d.toLocaleDateString('es-ES');
};

const mapCandidateData = (c) => ({
  id: c.id,
  name: buildFullName(c),
  specialty: c.specialty || 'N/A',
  profile: c.profile || null,
  location: c.location || 'Remoto',
  status: c.status,
  source: c.source || 'N/A',
  experience: c.experience || 'N/A',
  education: c.education || null,
  languages: c.languages || null,
  email: c.email || null,
  isAvailable: c.is_available ?? c.isAvailable ?? false,
  isFavorite: c.is_favourite ?? c.isFavourite ?? false,
  verified: c.verified ?? false,
  cvUrl: c.cv_url || null,
  managed_by_id: c.managed_by_id ?? null,
  phone: c.phone || null,
  candidateUrl: c.candidate_url || null,
  linkedinUrl: c.linkedin_url || null,
  githubUrl: c.github_url || null,
  portfolioUrl: c.portfolio_url || null,
  rawDate: c.created_at || c.time || null,
  time: formatFecha(c.created_at || c.time),
});

function buildListUrl(query = {}) {
  const sp = new URLSearchParams();
  if (query.verified === true) sp.set('verified', 'true');
  if (query.verified === false) sp.set('verified', 'false');
  if (query.location) sp.set('location', query.location);
  if (query.skills) sp.set('skills', query.skills);
  if (query.status) sp.set('status', query.status);
  if (query.source) sp.set('source', query.source);
  const qs = sp.toString();
  return qs
    ? `${ENDPOINTS.recruitment.candidatos.list}?${qs}`
    : ENDPOINTS.recruitment.candidatos.list;
}

export const candidatesService = {
  // Subir CV en PDF: el backend extrae los datos con Gemini y crea el candidato
  processCV: async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile);

    const response = await fetch(ENDPOINTS.recruitment.candidatos.processCV, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      // Capturamos el error EXACTO que devuelve FastAPI
      const errorText = await response.text();
      let errorMessage = `Error HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(errorText);
        errorMessage = errJson.detail
          ? JSON.stringify(errJson.detail)
          : errorText;
      } catch (e) {
        console.warn('La respuesta del error no era JSON:', e);
        errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  },

  getAllCandidates: async (query) => {
    try {
      const response = await authFetch(buildListUrl(query || {}));
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

  updateCandidateStatus: async (id, newStatus) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.updateStatus(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al actualizar estado del candidato ${id}:`, error);
      throw error;
    }
  },

  deleteCandidate: async (id) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.delete(id),
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      // ARREGLO: Manejar 204 No Content (respuesta vacía de FastAPI)
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    } catch (error) {
      console.error(`Error al eliminar el candidato ${id}:`, error);
      throw error;
    }
  },

  toggleFavorite: async (id, isFavourite) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.favourite(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favourite: isFavourite }),
        }
      );
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error al cambiar favorito del candidato ${id}:`, error);
      throw error;
    }
  },

  verifyCandidate: async (id, verified = true) => {
    const response = await authFetch(
      ENDPOINTS.recruitment.candidatos.verify(id),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      }
    );
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    return response.json();
  },

  applyBulkActions: async (candidateIds, actionName, targetUser = null) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.bulkActions,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate_ids: candidateIds,
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

  searchCandidatesByName: async (name) => {
    if (!name || name.length < 3) return [];

    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.search(name)
      );

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data.map(mapCandidateData);
    } catch (error) {
      console.error('Error al buscar candidatos por nombre:', error);
      throw error;
    }
  },

  getLocations: async () => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.locations
      );
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error al obtener la lista de ubicaciones:', error);
      return [];
    }
  },

  // --- CREAR CANDIDATO MANUALMENTE ---
  createCandidate: async (candidateData) => {
    try {
      const response = await authFetch(ENDPOINTS.recruitment.candidatos.list, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(candidateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al crear el candidato');
      }

      const data = await response.json();
      return mapCandidateData(data);
    } catch (error) {
      console.error('Error en createCandidate:', error);
      throw error;
    }
  },

  // --- EDITAR CANDIDATO EXISTENTE ---
  updateCandidate: async (id, candidateData) => {
    try {
      const response = await authFetch(
        ENDPOINTS.recruitment.candidatos.detail(id),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(candidateData),
        }
      );

      if (!response.ok) {
        throw new Error('Error al actualizar el candidato en el servidor');
      }

      // Leemos la respuesta como texto primero en lugar de forzar JSON
      const text = await response.text();
      // Si hay texto, lo parseamos, si está vacío (FastAPI no devuelve nada), devolvemos null
      const data = text ? JSON.parse(text) : null;

      // Devolvemos los datos ya mapeados (incluye cvUrl) para que la ficha
      // muestre el CV al instante, sin necesidad de refrescar la página.
      return data ? mapCandidateData(data) : null;
    } catch (error) {
      console.error(`Error en updateCandidate para el ID ${id}:`, error);
      throw error;
    }
  },
};
