import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Comprobamos si hay token en el almacenamiento local
  const token = localStorage.getItem("token");

  // Si no hay token, redirigimos a la página de login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Si hay token, permitimos el acceso a las rutas hijas
  return <Outlet />;
};

export default ProtectedRoute;