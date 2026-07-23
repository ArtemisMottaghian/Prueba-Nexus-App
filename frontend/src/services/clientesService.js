import { ENDPOINTS, authFetch } from './api';

const ESTADOS_CUENTA_VALIDOS = [
  'lead',
  'contactada',
  'en_negociacion',
  'cliente',
];

const normalizarEstadoCuenta = (raw) => {
  if (!raw) return 'lead';
  const v = String(raw).toLowerCase().trim().replace(/\s+/g, '_');

  if (v === 'new') return 'lead';
  if (v === 'contacted') return 'contactada';
  if (v === 'negotiating' || v === 'in_progress') return 'en_negociacion';
  if (v === 'converted' || v === 'confirmed_client') return 'cliente';

  if (v === 'negociacion' || v === 'negociando') return 'en_negociacion';
  if (ESTADOS_CUENTA_VALIDOS.includes(v)) return v;
  return 'lead';
};

const mapToFrontend = (client) => ({
  id: client.id,
  nombre: client.name || client.company_name || client.nombre || 'Desconocido',
  sector: client.sector,
  contactoPrincipal: client.primary_contact || client.contactoPrincipal,
  email: client.email,
  telefono: client.phone || client.telefono,
  vacantesAbiertas: client.open_positions ?? client.vacantesAbiertas ?? 0,
  rawDate: client.created_at || null,
  cif: client.cif || '',
  direccion: client.address || client.direccion || '',
  prioritario: client.prioritario || client.priority || false,
  estadoCuenta: normalizarEstadoCuenta(
    client.lead_status || client.account_status || client.entity_type || 'lead'
  ),
  responsable: client.account_owner || client.responsable || '',
  ultimoContacto: client.last_contact_at || client.ultimoContacto || null,
  acuerdos: client.agreements || client.acuerdos || [],
  historialComercial: (
    client.interactions ||
    client.historialComercial ||
    []
  ).map((h) => ({
    fecha: h.fecha || h.date,
    texto: h.texto || h.text || h.note,
    tipo: h.tipo || h.type || 'nota',
    autor: h.autor || h.author || '',
  })),
  documentosComerciales: (
    client.commercial_documents ||
    client.documentosComerciales ||
    []
  ).map((d) => ({
    nombre: d.nombre || d.name,
    tipo: d.tipo || d.type || 'Documento',
    fecha: d.fecha || d.date,
  })),
  vacantes: client.positions
    ? client.positions.map((p) => ({
        id: p.id,
        titulo: p.title,
        estado: p.status,
        fecha: p.date,
      }))
    : client.vacantes || [],
});

const statusMap = {
  lead: 'new',
  contactada: 'contacted',
  en_negociacion: 'negotiating',
  cliente: 'converted',
};

const mapToBackend = (client) => {
  const out = {
    name: client.nombre,
    sector: client.sector,
    cif: client.cif,
    address: client.direccion,
    email: client.email,
    phone: client.telefono,
    primary_contact: client.contactoPrincipal,
  };

  // El estado de cuenta solo viaja si viene informado; si no, el backend
  // conserva el actual (antes se mandaba siempre y una edición cualquiera
  // convertía al cliente en lead).
  if (client.estadoCuenta) {
    out.lead_status = statusMap[client.estadoCuenta] || 'new';
    if (client.estadoCuenta === 'cliente') out.entity_type = 'confirmed_client';
  }

  return out;
};

export const getClientes = async (entityType = 'confirmed_client') => {
  try {
    const separator = ENDPOINTS.companies.list.includes('?') ? '&' : '?';

    const urlFinal = entityType
      ? `${ENDPOINTS.companies.list}${separator}entity_type=${entityType}`
      : ENDPOINTS.companies.list;

    const response = await authFetch(urlFinal);

    if (!response.ok) throw new Error('Error al obtener clientes');

    const data = await response.json();
    return data.map(mapToFrontend);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw error;
  }
};

export const getClienteById = async (id) => {
  try {
    const response = await authFetch(ENDPOINTS.companies.detail(id));
    if (!response.ok) throw new Error('Error al obtener detalle del cliente');
    const data = await response.json();
    return mapToFrontend(data);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    throw error;
  }
};

// Traduce el estado de la oferta (backend) al texto que usa la ficha
const traducirEstadoOferta = (s) => {
  const map = {
    detected: 'Nueva',
    contacted: 'Contactada',
    negotiating: 'En proceso',
    won: 'Ganada',
    discarded: 'Descartada',
  };
  return map[(s || '').toLowerCase()] || 'Nueva';
};

// Obtiene las ofertas vinculadas a una empresa/cliente
export const getVacantesByCliente = async (companyId) => {
  try {
    const res = await authFetch(ENDPOINTS.companies.vacancies(companyId));
    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
    const data = await res.json();
    return data.map((o) => ({
      id: o.id,
      titulo: o.title,
      estado: traducirEstadoOferta(o.status),
      fecha: o.published_at
        ? new Date(o.published_at).toLocaleDateString('es-ES')
        : '',
    }));
  } catch (err) {
    console.error('Error al obtener las vacantes del cliente:', err);
    return [];
  }
};

export const getClienteByNombre = async (nombre) => {
  if (!nombre) return null;
  const target = String(nombre).toLowerCase().trim();
  try {
    const clientes = await getClientes();
    return (
      clientes.find((c) => String(c.nombre).toLowerCase().trim() === target) ||
      null
    );
  } catch (error) {
    console.error('Error al buscar cliente por nombre:', error);
    throw error;
  }
};

export const createCliente = async (cliente) => {
  const response = await authFetch(ENDPOINTS.companies.create, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapToBackend(cliente)),
  });
  if (!response.ok) throw new Error('Error al crear cliente');
  const data = await response.json();
  return mapToFrontend(data);
};

export const updateCliente = async (id, cliente) => {
  const response = await authFetch(ENDPOINTS.companies.update(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapToBackend(cliente)),
  });
  if (!response.ok) throw new Error('Error al actualizar cliente');
  const data = await response.json();
  return mapToFrontend({ ...data, id });
};

export const updateEstadoCuenta = async (id, nuevoEstado) => {
  const estado = normalizarEstadoCuenta(nuevoEstado);

  // Mantenemos entity_type coherente con el estado (Fase 4): solo es
  // 'confirmed_client' cuando es cliente; en cualquier otro estado se limpia
  // para que los dos campos (lead_status y entity_type) nunca se contradigan.
  const payload = {
    lead_status: statusMap[estado] || 'new',
    entity_type: estado === 'cliente' ? 'confirmed_client' : null,
  };

  try {
    const response = await authFetch(ENDPOINTS.companies.update(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Error al actualizar en el servidor');

    return { id, estadoCuenta: estado };
  } catch (error) {
    console.error('Error en la sincronización:', error);
    return { id, estadoCuenta: estado };
  }
};

export const deleteCliente = async (id) => {
  const response = await authFetch(ENDPOINTS.companies.delete(id), {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar cliente');
  return await response.json();
};

export const assignUserToCompanies = async (companyIds, userId) => {
  try {
    const response = await authFetch(ENDPOINTS.companies.assignUser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_ids: companyIds,
        user_id: userId,
      }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error al asignar empresas masivamente:', error);
    throw error;
  }
};

export const getClienteComments = async (companyId) => {
  const response = await authFetch(ENDPOINTS.companies.comments(companyId));
  if (!response.ok) throw new Error('Error al obtener notas');
  return await response.json();
};

export const addClienteComment = async (companyId, body) => {
  const response = await authFetch(ENDPOINTS.companies.comments(companyId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Error al guardar nota');
  return await response.json();
};

export const deleteClienteComment = async (commentId) => {
  const response = await authFetch(
    ENDPOINTS.companies.updateComment(commentId),
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) throw new Error('Error al eliminar nota');
  return await response.json();
};

// ── Interacciones comerciales (llamadas, reuniones, emails...) ──────────────

export const getClienteInteracciones = async (companyId) => {
  const response = await authFetch(ENDPOINTS.companies.interactions(companyId));
  if (!response.ok) throw new Error('Error al obtener las interacciones');
  return await response.json();
};

export const addClienteInteraccion = async (companyId, body) => {
  const response = await authFetch(
    ENDPOINTS.companies.interactions(companyId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) throw new Error('Error al registrar la interacción');
  return await response.json();
};

export const eliminarClienteInteraccion = async (interactionId) => {
  const response = await authFetch(
    ENDPOINTS.companies.interactionDelete(interactionId),
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Error al eliminar la interacción');
  return await response.json();
};

// ── Documentos de empresa (contratos, propuestas, facturas...) ──────────────

export const getClienteDocumentos = async (companyId) => {
  const response = await authFetch(ENDPOINTS.companies.documents(companyId));
  if (!response.ok) throw new Error('Error al obtener los documentos');
  return await response.json();
};

export const subirClienteDocumento = async (companyId, file, tipo) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('tipo', tipo || 'Otro');

  // fetch directo (sin authFetch): con FormData el navegador debe poner
  // solo el Content-Type multipart con su boundary
  const response = await fetch(ENDPOINTS.companies.documents(companyId), {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) throw new Error('Error al subir el documento');
  return await response.json();
};

export const eliminarClienteDocumento = async (docId) => {
  const response = await authFetch(ENDPOINTS.companies.documentDelete(docId), {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar el documento');
  return await response.json();
};
