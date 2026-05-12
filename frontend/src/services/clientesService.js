import { ENDPOINTS, authFetch } from './api';
import clientesDummy from '../data/clientesData.json';

const ESTADOS_CUENTA_VALIDOS = [
  'lead',
  'contactada',
  'en_negociacion',
  'cliente',
];

const normalizarEstadoCuenta = (raw) => {
  if (!raw) return 'lead';
  const v = String(raw).toLowerCase().trim().replace(/\s+/g, '_');
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
  cif: client.cif || '',
  direccion: client.address || client.direccion || '',
  prioritario: client.prioritario || client.priority || false,
  estadoCuenta: normalizarEstadoCuenta(
    client.lead_status || client.account_status || client.estadoCuenta
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

const mapToBackend = (client) => ({
  name: client.nombre,
  sector: client.sector,
  primary_contact: client.contactoPrincipal,
  email: client.email,
  phone: client.telefono,
  cif: client.cif,
  address: client.direccion,
  lead_status: client.estadoCuenta,
  account_owner: client.responsable,
});

const getClientesDummy = () => clientesDummy.map(mapToFrontend);
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
    console.warn(
      'Backend offline o fallando, usando datos de prueba...',
      error
    );

    const dummyData = getClientesDummy();
    if (entityType) {
      return dummyData
        .filter((c) => c.entity_type === entityType)
        .map(mapToFrontend);
    }
    return dummyData;
  }
};

export const getClienteById = async (id) => {
  try {
    const response = await authFetch(ENDPOINTS.companies.detail(id));
    if (!response.ok) throw new Error('Error al obtener detalle del cliente');
    const data = await response.json();
    return mapToFrontend(data);
  } catch (error) {
    console.warn('Backend offline, buscando cliente en dummy...', error);
    const encontrado = clientesDummy.find((c) => String(c.id) === String(id));
    return encontrado ? mapToFrontend(encontrado) : null;
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
    console.warn('Fallback a dummy en getClienteByNombre', error);
    const encontrado = clientesDummy.find(
      (c) => String(c.nombre).toLowerCase().trim() === target
    );
    return encontrado ? mapToFrontend(encontrado) : null;
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
  try {
    const response = await authFetch(ENDPOINTS.companies.update(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_status: estado }),
    });
    if (!response.ok) throw new Error('Error al actualizar estado de cuenta');
    return { id, estadoCuenta: estado };
  } catch (error) {
    console.warn(
      'Backend offline — estado de cuenta actualizado solo en cliente.',
      error
    );
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
