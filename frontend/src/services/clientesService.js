import { ENDPOINTS, authFetch } from './api';

const mapToFrontend = (client) => ({
  id: client.id,
  nombre: client.company_name,
  sector: client.sector,
  contactoPrincipal: client.primary_contact,
  email: client.email,
  telefono: client.phone,
  vacantesAbiertas: client.open_positions || 0,
  cif: client.cif || '',
  direccion: client.address || '',
  prioritario: false,
  vacantes: client.positions
    ? client.positions.map((p) => ({
        id: p.id,
        titulo: p.title,
        estado: p.status,
        fecha: p.date,
      }))
    : [],
});

const mapToBackend = (client) => ({
  company_name: client.nombre,
  sector: client.sector,
  primary_contact: client.contactoPrincipal,
  email: client.email,
  phone: client.telefono,
  cif: client.cif,
  address: client.direccion,
});

export const getClientes = async () => {
  const response = await authFetch(ENDPOINTS.crm.clientes);
  if (!response.ok) throw new Error('Error al obtener clientes');
  const data = await response.json();
  return data.map(mapToFrontend);
};

export const getClienteById = async (id) => {
  const response = await authFetch(ENDPOINTS.crm.clienteDetalle(id));
  if (!response.ok) throw new Error('Error al obtener detalle del cliente');
  const data = await response.json();
  return mapToFrontend(data);
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
