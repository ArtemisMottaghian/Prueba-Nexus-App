// ============================================
// authService.js
// Servicio para manejar autenticación con el backend
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Login tradicional con email y contraseña
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{access_token: string, token_type: string}>}
 */

// TODO (BACKEND): Eliminar lógica mock inferior e integrar llamada real a POST /api/auth.
// El endpoint debe verificar el hash de la contraseña en BD y emitir un JWT (Bearer).
// IMPORTANTE: El payload codificado del JWT deberá tener estrictamente los atributos: { sub: email, role: 'admin'|'company'|'hr_manager', id: uuid }

// se pasa esto desde backend
/*
token_data = {
        "sub": usuario.email,
        "role": usuario.role.value,
        "id": usuario.id
    }
    access_token = create_access_token(data=token_data)

    return {"access_token": access_token, "token_type": "bearer"}
*/
export const login = async (email, password) => {
  try {
    // Usamos URLSearchParams para emular un formulario web (Requisito de OAuth2)
    const formData = new URLSearchParams();

    formData.append('username', email.trim());
    formData.append('password', password);

    // peticion a backend
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Error al iniciar sesión');
    }

    return data;
  } catch (error) {
    console.error('Error en authService.login:', error);
    throw error;
  }
};

/**
 * Inicia el flujo de login con Google
 * Redirige al usuario a Google OAuth
 */
export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/api/login/google/login`;
};

/**
 * Decodifica el JWT para obtener los datos del usuario
 * @param {string} token
 * @returns {{sub: string, role: string, id: number} | null}
 */
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error al decodificar token:', error);
    return null;
  }
};

/**
 * Obtiene el usuario actual desde el token almacenado
 * @returns {{email: string, role: string, id: number} | null}
 */
export const getCurrentUser = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const decoded = decodeToken(token);
  if (!decoded) return null;

  return {
    email: decoded.sub,
    role: decoded.role,
    id: decoded.id,
  };
};

/**
 * Verifica si el token es válido y no ha expirado
 * @returns {boolean}
 */
export const isTokenValid = () => {
  const token =
    localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) return false;

  const decoded = decodeToken(token);
  if (!decoded) return false;

  // Verificar si el token ha expirado
  if (decoded.exp) {
    const now = Date.now() / 1000;
    return decoded.exp > now;
  }

  return true;
};

/**
 * Obtiene el usuario a partir de un token proporcionado directamente
 * @param {string} token
 * @returns {{email: string, role: string, id: number} | null}
 */
export const getCurrentUserFromToken = (token) => {
  if (!token) return null;
  const decoded = decodeToken(token);
  if (!decoded) return null;
  return {
    email: decoded.sub,
    role: decoded.role,
    id: decoded.id,
  };
};

/**
 * Verifica si un token proporcionado es válido y no ha expirado
 * @param {string} token
 * @returns {boolean}
 */
export const isTokenValidFromToken = (token) => {
  if (!token) return false;
  const decoded = decodeToken(token);
  if (!decoded) return false;
  if (decoded.exp) {
    const now = Date.now() / 1000;
    return decoded.exp > now;
  }
  return true;
};

/**
 * Cierra sesión eliminando el token de ambos storages
 */
export const logout = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  window.location.href = '/login';
};
