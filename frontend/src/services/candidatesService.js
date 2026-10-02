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

const FIELD_LABELS = {
  first_name: 'Nombre',
  last_name: 'Apellido',
  email: 'Email',
  phone: 'Teléfono',
  location: 'Localización',
  skills: 'Habilidades',
  experience: 'Experiencia',
  education: 'Formación',
  languages: 'Idiomas',
  profile: 'Perfil',
};

const describeValidationError = (err) => {
  const field = err.loc?.[err.loc.length - 1];
  const label = FIELD_LABELS[field] || field || 'Un campo';
  switch (err.type) {
    case 'missing':
      return `${label} es obligatorio`;
    case 'string_too_short':
      return `${label} debe tener al menos ${err.ctx?.min_length ?? 2} caracteres`;
    case 'string_too_long':
      return `${label} no puede superar ${err.ctx?.max_length} caracteres`;
    case 'string_pattern_mismatch':
    case 'value_error':
      return `${label} no tiene un formato válido`;
    default:
      return `${label}: ${err.msg}`;
  }
};

// FastAPI devuelve `detail` como texto, o como lista de errores de validación
// (objetos). Lo convertimos siempre a un texto que el usuario pueda leer.
const formatApiDetail = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(describeValidationError).join('; ');
  }
  return JSON.stringify(detail);
};

const readErrorMessage = async (response, fallback) => {
  try {
    const body = await response.json();
    return formatApiDetail(body?.detail) || fallback;
  } catch {
    return fallback;
  }
};

// Cuando el servidor falla sin controlar el error (p. ej. email duplicado) el
// navegador no llega a leer la respuesta y solo lanza "Failed to fetch".
const isNetworkError = (error) =>
  error instanceof TypeError &&
  /fetch|network|load failed/i.test(error.message);

const CREATE_NETWORK_ERROR =
  'El servidor no ha podido guardar el candidato. Lo más probable es que ya exista un candidato con ese email; si no es así, revisa tu conexión e inténtalo de nuevo.';
const UPDATE_NETWORK_ERROR =
  'No se ha podido contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';

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

  // Leer un CV en PDF para rellenar el formulario de alta. No guarda nada en el
  // servidor: el candidato se crea después, al pulsar Guardar.
  extractCV: async (pdfFile) => {
    const formData = new FormData();
    formData.append('pdf_file', pdfFile);

    try {
      // fetch normal (no authFetch): este fuerza Content-Type JSON y rompería el archivo
      const response = await fetch(ENDPOINTS.recruitment.candidatos.extractCV, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = new Error(
          await readErrorMessage(
            response,
            `Error al leer el PDF (HTTP ${response.status})`
          )
        );
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      console.error('Error en extractCV:', error);
      if (isNetworkError(error)) throw new Error(UPDATE_NETWORK_ERROR);
      throw error;
    }
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
        throw new Error(
          await readErrorMessage(
            response,
            `Error al crear el candidato (HTTP ${response.status})`
          )
        );
      }

      const data = await response.json();
      return mapCandidateData(data);
    } catch (error) {
      console.error('Error en createCandidate:', error);
      if (isNetworkError(error)) throw new Error(CREATE_NETWORK_ERROR);
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
        throw new Error(
          await readErrorMessage(
            response,
            'Error al actualizar el candidato en el servidor'
          )
        );
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
      if (isNetworkError(error)) throw new Error(UPDATE_NETWORK_ERROR);
      throw error;
    }
  },
};
