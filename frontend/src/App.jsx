import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Componentes de Layout
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ActivityPanel from './components/layout/ActivityPanel';

// Autenticación
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';

// Páginas
import Dashboard from './pages/Dashboard';
import Vacancies from './pages/Vacancies';
import Calendario from './pages/Calendar';
import Clientes from './pages/Clientes';
import Candidates from './pages/Candidates';

import './index.css';

function App() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [activityAbierto, setActivityAbierto] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. RUTA PÚBLICA: Pantalla completa para el login */}
        <Route path="/login" element={<LoginForm />} />

        {/* 2. RUTAS PRIVADAS: Todo lo que requiere estar logueado */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={
              <div className="ara-container">
                {/* El Sidebar ya incluye su propio Overlay y lógica onClose */}
                <Sidebar
                  isOpen={sidebarAbierto}
                  onClose={() => setSidebarAbierto(false)}
                />

                <main className="ara-main">
                  <Topbar
                    onMenuToggle={() => setSidebarAbierto((prev) => !prev)}
                    onActivityToggle={() => setActivityAbierto((prev) => !prev)}
                  />

                  <div className="ara-content">
                    <div className="content-scroll">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/vacantes" element={<Vacancies />} />
                        <Route path="/calendar" element={<Calendario />} />
                        <Route path="/clientes" element={<Clientes />} />
                        <Route path="/candidatos" element={<Candidates />} />

                        {/* Redirección por si el usuario escribe una ruta inexistente */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                  </div>
                </main>

                <ActivityPanel
                  isOpen={activityAbierto}
                  onClose={() => setActivityAbierto(false)}
                />
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
