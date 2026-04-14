import { ENDPOINTS, authFetch } from './api';

// Función para mapear los datos del backend a lo que espera tu frontend
const mapUserData = (u) => {
  const nombreDelCorreo = u.email ? u.email.split('@')[0] : 'Usuario';

  return {
    id: u.id,
    name: u.name || u.full_name || nombreDelCorreo,
    email: u.email,
    role: u.role,
    status: u.status || 'active',
    createdAt: u.created_at
      ? new Date(u.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    avatar: u.avatar || `https://i.pravatar.cc/150?u=${u.id}`,
  };
};

export const usersService = {
  getAllUsers: async () => {
    try {
      const response = await authFetch(ENDPOINTS.users.list);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return data.map(mapUserData);
    } catch (error) {
      console.error('Error al obtener la lista de usuarios:', error);
      throw error;
    }
  },

  createUser: async (userData) => {
    try {
      const response = await authFetch(ENDPOINTS.users.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      return mapUserData(data);
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  },

  deleteUser: async (id) => {
    try {
      const response = await authFetch(ENDPOINTS.users.delete(id), {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return true;
    } catch (error) {
      console.error(`Error al eliminar usuario ${id}:`, error);
      throw error;
    }
  },
};
