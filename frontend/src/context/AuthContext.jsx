import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import * as authService from '../services/authService';
import { authFetch, ENDPOINTS } from '../services/api';

const AuthContext = createContext(null);

// Cierre de sesión automático tras este tiempo sin actividad del usuario
const LIMITE_INACTIVIDAD_MS = 40 * 60 * 1000; // 40 minutos

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar: verificar sesión activa consultando /me con la cookie httpOnly
  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await authFetch(ENDPOINTS.users.me);
        if (response.ok) {
          const userData = await response.json();
          setUser({
            email: userData.email,
            role: userData.role,
            id: userData.id,
          });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login con email y contraseña.
   * rememberMe se mantiene en la firma por compatibilidad con LoginForm;
   * la duración de la sesión la controla el backend via max_age de la cookie.
   */
  const login = async (email, password) => {
    try {
      await authService.login(email, password);

      // Obtener datos del usuario desde /me (la cookie ya fue fijada por el login)
      const meResponse = await authFetch(ENDPOINTS.users.me);
      if (!meResponse.ok)
        throw new Error('No se pudo obtener información del usuario');
      const userData = await meResponse.json();
      setUser({ email: userData.email, role: userData.role, id: userData.id });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Error al iniciar sesión',
      };
    }
  };

  const loginWithGoogle = () => {
    authService.loginWithGoogle();
  };

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  // --- Cierre de sesión por inactividad (40 min sin ratón/teclado/scroll) ---
  const ultimaActividadRef = useRef(Date.now());

  useEffect(() => {
    if (!user) return undefined;

    const marcarActividad = () => {
      ultimaActividadRef.current = Date.now();
    };

    const eventos = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];
    eventos.forEach((ev) =>
      window.addEventListener(ev, marcarActividad, { passive: true })
    );
    ultimaActividadRef.current = Date.now();

    // Cada minuto comprobamos si se superó el límite
    const vigilante = setInterval(() => {
      if (Date.now() - ultimaActividadRef.current >= LIMITE_INACTIVIDAD_MS) {
        // Marca para que el login muestre el aviso de por qué se cerró
        sessionStorage.setItem('cierreSesionInactividad', '1');
        logout();
      }
    }, 60 * 1000);

    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, marcarActividad));
      clearInterval(vigilante);
    };
  }, [user, logout]);

  const hasRole = (role) => user?.role === role;

  const hasAnyRole = (roles) => roles.includes(user?.role);

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
    hasRole,
    hasAnyRole,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
