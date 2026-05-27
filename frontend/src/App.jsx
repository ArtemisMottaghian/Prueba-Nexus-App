import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Componentes de Layout
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
// Autenticación
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
// Páginas
import Dashboard from './pages/Dashboard';
import Vacancies from './pages/Vacancies';
import Calendario from './pages/Calendar';
import Clientes from './pages/Clientes';
import Candidates from './pages/Candidates';
import CandidateDetail from './pages/CandidateDetail';   
import UserManagement from './components/settings/UserManagement';
import MiCuenta from './components/settings/MiCuenta';
import InboxPage from './pages/InboxPage';
// Issue #452 — URL pública de vacante (sin login)
import VacancyPublicDetail from './components/recruitment/vacancies/VacancyPublicDetail';
import './index.css';

function App() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. RUTAS PÚBLICAS: Sin autenticación requerida */}
        <Route path="/login" element={<LoginForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Issue #452 — Detalle de vacante para candidatos externos (noindex) */}
        <Route path="/vacante/:id" element={<VacancyPublicDetail />} />

        {/* 2. RUTAS PRIVADAS: Todo lo que requiere estar logueado */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={
              <div className="ara-container">
                <Sidebar
                  isOpen={sidebarAbierto}
                  onClose={() => setSidebarAbierto(false)}
                />
                <main className="ara-main">
                  <Topbar
                    onMenuToggle={() => setSidebarAbierto((prev) => !prev)}
                  />
                  <div className="ara-content">
                    <div className="content-scroll">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/vacantes" element={<Vacancies />} />
                        <Route path="/calendar" element={<Calendario />} />
                        <Route
                          element={
                            <ProtectedRoute
                              allowedRoles={['admin', 'negocio', 'company']}
                            />
                          }
                        >
                          <Route path="/clientes" element={<Clientes />} />
                        </Route>
                        <Route path="/candidatos" element={<Candidates />} />
                        <Route path="/candidates/:id" element={<CandidateDetail />} />  
                        {/* --- NUEVA RUTA DEL INBOX --- */}
                        <Route path="/inbox" element={<InboxPage />} />
                        <Route path="/cuenta" element={<MiCuenta />} />
                        <Route path="/settings" element={<UserManagement />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                  </div>
                </main>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;