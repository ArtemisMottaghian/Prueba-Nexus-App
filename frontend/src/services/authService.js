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
export const login = async (email, password) => {
  // MOCK LOGIN: Devolvemos un token falso validado para fingir inicio de sesión
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let assignedRole = null;
      if (email === 'admin@admin.com' && password === 'Admin1234') {
        assignedRole = 'admin';
      } else if (
        email === 'reclutador@reclutador.com' &&
        password === 'Reclutador1234'
      ) {
        assignedRole = 'reclutador';
      } else if (
        email === 'negocio@negocio.com' &&
        password === 'Negocio1234'
      ) {
        assignedRole = 'negocio';
      }

      // Bloquear acceso a cuentas no autorizadas en este Mock
      if (!assignedRole) {
        return reject(
          new Error('Credenciales incorrectas o cuenta no autorizada.')
        );
      }

      // Creamos un payload válido con expiración en 1 hora
      const payload = {
        sub: email,
        role: assignedRole,
        id: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      // Codificamos en base64 para engañar a decodeToken
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify(payload)) +
        '.signature';

      resolve({ access_token: fakeToken, token_type: 'bearer' });
    }, 1000);
  });
};

/**
 * Inicia el flujo de login con Google
 * Redirige al usuario a Google OAuth
 */
export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/api/auth/google/login`;
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
  const token = localStorage.getItem('token');
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
 * Cierra sesión eliminando el token
 */
export const logout = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};
