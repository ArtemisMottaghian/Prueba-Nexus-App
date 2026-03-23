import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ActivityPanel from './components/layout/ActivityPanel';
import Dashboard from './pages/Dashboard';
import Vacancies from './pages/Vacancies';
import Calendario from './pages/Calendar';
import Clientes from './pages/Clientes';
import Candidatos from './pages/Candidatos';

import './index.css';

function App() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [activityAbierto, setActivityAbierto] = useState(false);

  return (
    <BrowserRouter>
      <div className="ara-container">
        {/* Overlay para cerrar sidebar en móvil */}
        {sidebarAbierto && (
          <div
            className="d-lg-none"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1030,
            }}
            onClick={() => setSidebarAbierto(false)}
          />
        )}

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
                <Route path="/Calendar" element={<Calendario />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/candidatos" element={<Candidatos />} />
              </Routes>
            </div>
          </div>
        </main>

        <ActivityPanel
          isOpen={activityAbierto}
          onClose={() => setActivityAbierto(false)}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
