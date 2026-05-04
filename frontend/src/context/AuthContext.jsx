// ============================================
// AuthContext.jsx
// Contexto global para autenticación
// ============================================

import { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

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

  /**
   * Obtiene el token de donde esté almacenado (localStorage o sessionStorage)
   */
  const getStoredToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  /**
   * Elimina el token de ambos storages
   */
  const clearStoredToken = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  };

  // Al montar el componente, verificar si hay un usuario logueado
  useEffect(() => {
    const initAuth = () => {
      const token = getStoredToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const isValid = authService.isTokenValidFromToken(token);
      const currentUser = authService.getCurrentUserFromToken(token);

      console.log('¿Token válido según el frontend?:', isValid);

      if (currentUser && isValid) {
        setUser(currentUser);
      } else {
        // Token inválido o expirado
        clearStoredToken();
        setUser(null);
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Login con email y contraseña
   * @param {boolean} rememberMe — si true, persiste en localStorage; si false, solo en sessionStorage
   */
  const login = async (email, password, rememberMe = false) => {
    try {
      const data = await authService.login(email, password);

      // Guardar token en el storage adecuado

      if (rememberMe) {
        localStorage.setItem('token', data.access_token);
      } else {
        sessionStorage.setItem('token', data.access_token);
      }

      // Decodificar y establecer usuario
      const currentUser = authService.getCurrentUserFromToken(
        data.access_token
      );
      setUser(currentUser);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Error al iniciar sesión',
      };
    }
  };

  /**
   * Login con Google
   */
  const loginWithGoogle = () => {
    authService.loginWithGoogle();
  };

  /**
   * Logout
   */
  const logout = () => {
    authService.logout();
    setUser(null);
  };

  /**
   * Verificar si el usuario tiene un rol específico
   */
  const hasRole = (role) => {
    return user?.role === role;
  };

  /**
   * Verificar si el usuario tiene alguno de los roles especificados
   */
  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };

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
