import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ActivityPanel from './components/layout/ActivityPanel';
import Dashboard from './pages/Dashboard';
import Vacancies from './pages/Vacancies';

import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="ara-container">
        
        <Sidebar />
        
        <main className="ara-main">
          <Topbar />
          <div className="ara-content">
            <div className="content-scroll">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vacantes" element={<Vacancies />} />
              </Routes>
              
            </div>
          </div>
        </main>

        <ActivityPanel />
        
      </div>
    </BrowserRouter>
  );
}

export default App;