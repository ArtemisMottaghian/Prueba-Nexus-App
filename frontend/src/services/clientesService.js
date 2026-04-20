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
  nombre: client.company_name || client.nombre,
  sector: client.sector,
  contactoPrincipal: client.primary_contact || client.contactoPrincipal,
  email: client.email,
  telefono: client.phone || client.telefono,
  vacantesAbiertas: client.open_positions ?? client.vacantesAbiertas ?? 0,
  cif: client.cif || '',
  direccion: client.address || client.direccion || '',
  prioritario: client.prioritario || client.priority || false,
  // === Seguimiento comercial a nivel EMPRESA (Issue #329) ===
  estadoCuenta: normalizarEstadoCuenta(
    client.account_status || client.estadoCuenta
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
  company_name: client.nombre,
  sector: client.sector,
  primary_contact: client.contactoPrincipal,
  email: client.email,
  phone: client.telefono,
  cif: client.cif,
  address: client.direccion,
  account_status: client.estadoCuenta,
  account_owner: client.responsable,
});

// Fallback local si el backend está offline
const getClientesDummy = () => clientesDummy.map(mapToFrontend);

export const getClientes = async () => {
  try {
    const response = await authFetch(ENDPOINTS.crm.clientes);
    if (!response.ok) throw new Error('Error al obtener clientes');
    const data = await response.json();
    return data.map(mapToFrontend);
  } catch (error) {
    console.warn('Backend offline, usando clientesData.json...', error);
    return getClientesDummy();
  }
};

export const getClienteById = async (id) => {
  try {
    const response = await authFetch(ENDPOINTS.crm.clienteDetalle(id));
    if (!response.ok) throw new Error('Error al obtener detalle del cliente');
    const data = await response.json();
    return mapToFrontend(data);
  } catch (error) {
    console.warn('Backend offline, buscando cliente en dummy...', error);
    const encontrado = clientesDummy.find((c) => String(c.id) === String(id));
    return encontrado ? mapToFrontend(encontrado) : null;
  }
};

/**
 * Busca un cliente (empresa) por nombre exacto o coincidencia case-insensitive.
 * Se usa desde VacancyModal para cargar el CRM asociado a la empresa de la vacante.
 */
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
  const response = await authFetch(ENDPOINTS.crm.clientes, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapToBackend(cliente)),
  });
  if (!response.ok) throw new Error('Error al crear cliente');
  const data = await response.json();
  return mapToFrontend(data);
};

export const updateCliente = async (id, cliente) => {
  const response = await authFetch(ENDPOINTS.crm.clienteDetalle(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapToBackend(cliente)),
  });
  if (!response.ok) throw new Error('Error al actualizar cliente');
  const data = await response.json();
  return mapToFrontend({ ...data, id }); // Añadimos ID si el backend solo devuelve los campos actualizados
};

/**
 * Actualiza SÓLO el estado comercial de la cuenta (lead / contactada / en_negociacion / cliente).
 * Al convertirse en 'cliente' (firma), el estado se propaga en todo el sistema (todas las vacantes
 * de esa empresa leerán el nuevo estado en la siguiente carga).
 */
export const updateEstadoCuenta = async (id, nuevoEstado) => {
  const estado = normalizarEstadoCuenta(nuevoEstado);
  try {
    const response = await authFetch(ENDPOINTS.crm.clienteDetalle(id), {
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
  const response = await authFetch(ENDPOINTS.crm.clienteDetalle(id), {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar cliente');
  return await response.json();
};

export const getClienteVacantes = async (id) => {
  const response = await authFetch(ENDPOINTS.crm.clienteVacantes(id));
  if (!response.ok) throw new Error('Error al obtener vacantes del cliente');
  const data = await response.json();
  return data.map((p) => ({
    id: p.id,
    titulo: p.title,
    estado: p.status,
    fecha: p.date,
  }));
};
