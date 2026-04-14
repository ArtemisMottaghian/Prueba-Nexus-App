// ============================================
// ProtectedRoute.jsx
// Componente para proteger rutas según autenticación y roles
// ============================================

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Componente para proteger rutas que requieren autenticación
 * @param {string[]} allowedRoles - Roles permitidos para acceder a la ruta
 */
const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  // Mientras carga, mostrar un spinner o nada
  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: '100vh' }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  // Si no hay usuario, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si se especificaron roles permitidos, verificar
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // El usuario no tiene permiso, redirigir según su rol
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  // Usuario autenticado y con permisos correctos
  return <Outlet />;
};

/**
 * Obtiene la ruta por defecto según el rol del usuario
 */
const getDefaultRouteForRole = (role) => {
  switch (role) {
    case 'admin':
      return '/dashboard'; // Administradores van al dashboard completo
    case 'hr_manager':
      return '/candidates'; // Reclutadores van al módulo de candidatos
    case 'company':
      return '/clientes'; // Empresas van al módulo de clientes
    default:
      return '/';
  }
};

export default ProtectedRoute;
