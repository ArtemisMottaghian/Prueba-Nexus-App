import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ActivityPanel from './components/layout/ActivityPanel';
import ProtectedRoute from './components/auth/ProtectedRoute'; // Ruta protegida
import LoginForm from './components/auth/LoginForm'; // Formulario de login

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
        {/* RUTA PÚBLICA: No lleva Sidebar ni nada */}
        <Route path="/login" element={<LoginForm />} />

        {/* RUTAS PRIVADAS: Protegidas por ProtectedRoute */}
        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={
            <div className="ara-container">
              <Sidebar isOpen={sidebarAbierto} onClose={() => setSidebarAbierto(false)} />
              <main className="ara-main">
                <Topbar 
                  onMenuToggle={() => setSidebarAbierto(prev => !prev)} 
                  onActivityToggle={() => setActivityAbierto(prev => !prev)} 
                />
                <div className="ara-content">
                  <div className="content-scroll">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/vacantes" element={<Vacancies />} />
                      <Route path="/Calendar" element={<Calendario />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/candidatos" element={<Candidates />} />
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </div>
                </div>
              </main>
              <ActivityPanel isOpen={activityAbierto} onClose={() => setActivityAbierto(false)} />
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;