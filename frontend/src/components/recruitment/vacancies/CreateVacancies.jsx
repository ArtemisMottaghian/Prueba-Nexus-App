import { useState } from 'react';
import './CreateVacancies.css'; 

export default function CreateVacancy({ onClose, onSave }) {
  // 1. Estado inicial del formulario con todos los campos solicitados
  const [formData, setFormData] = useState({
    title: '',              // Nombre de la vacante
    location: '',           // Ubicación
    sector: '',             // Sector / Industria
    source: '',             // Fuente de origen
    salaryRange: '',        // Rango salarial
    activeVacancies: 1,     // Vacantes activas con esta empresa (por defecto 1)
    publishedAgo: ''        // Hace cuánto ha sido publicada
  });

  // 2. Manejador genérico para todos los inputs y selects
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // 3. Procesar el envío
  const handleSubmit = (e) => {
    e.preventDefault();

    // Estructuramos el objeto que enviaremos a Page/vacancies.jsx
    const newVacancyData = {
      title: formData.title.trim(),
      location: formData.location.trim(),
      industry: formData.sector.trim(), // Lo mapeamos a 'industry' como usa tu sistema
      source: formData.source || 'Carga Manual',
      salaryRange: formData.salaryRange.trim(),
      companyActiveJobs: parseInt(formData.activeVacancies, 10) || 1,
      publishedAgo: formData.publishedAgo,
      // Campos automáticos por defecto para una nueva vacante
      status: 'Nueva', 
      isFavorite: false,
      createdAt: new Date().toISOString()
    };

    onSave(newVacancyData);
  };

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      
      {/* Aplicamos la clase custom-create-modal para el efecto Glassmorphism */}
      <div className="modal fade show d-block custom-create-modal" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            
            <div className="modal-header">
              <h4 className="modal-title fw-bold">Añadir Nueva Vacante</h4>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
                aria-label="Cerrar"
              ></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                {/* 1. Nombre de la Vacante (Title) */}
                <div className="mb-4">
                  <label htmlFor="title" className="form-label fw-semibold">
                    Nombre de la vacante <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Ej. Senior Frontend Developer"
                    required
                  />
                </div>

                <div className="row">
                  {/* 2. Ubicación */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="location" className="form-label fw-semibold">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Ej. Madrid, España (o Remoto)"
                    />
                  </div>

                  {/* 3. Sector / Industria */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="sector" className="form-label fw-semibold">
                      Sector
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="sector"
                      name="sector"
                      value={formData.sector}
                      onChange={handleChange}
                      placeholder="Ej. Tecnología, Finanzas, Salud..."
                    />
                  </div>
                </div>

                <div className="row">
                  {/* 4. Fuente de origen */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="source" className="form-label fw-semibold">
                      Fuente de origen
                    </label>
                    <select
                      className="form-select"
                      id="source"
                      name="source"
                      value={formData.source}
                      onChange={handleChange}
                    >
                      <option value="">Selecciona el origen...</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="InfoJobs">InfoJobs</option>
                      <option value="Adzuna">Adzuna</option>
                      <option value="Búsqueda Directa">Búsqueda Directa</option>
                      <option value="Carga Manual">Carga Manual Interna</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  {/* 5. Rango Salarial */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="salaryRange" className="form-label fw-semibold">
                      Rango Salarial
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="salaryRange"
                      name="salaryRange"
                      value={formData.salaryRange}
                      onChange={handleChange}
                      placeholder="Ej. 35.000€ - 45.000€"
                    />
                  </div>
                </div>

                <div className="row">
                  {/* 6. Vacantes activas con esta empresa */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="activeVacancies" className="form-label fw-semibold">
                      Vacantes activas con esta empresa
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="activeVacancies"
                      name="activeVacancies"
                      value={formData.activeVacancies}
                      onChange={handleChange}
                      min="1"
                      placeholder="Ej. 2"
                    />
                  </div>

                  {/* 7. Hace cuánto ha sido publicada */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="publishedAgo" className="form-label fw-semibold">
                      Publicada hace...
                    </label>
                    <select
                      className="form-select"
                      id="publishedAgo"
                      name="publishedAgo"
                      value={formData.publishedAgo}
                      onChange={handleChange}
                    >
                      <option value="">Selecciona un tiempo...</option>
                      <option value="Hoy">Hoy</option>
                      <option value="Ayer">Ayer</option>
                      <option value="Esta semana">Esta semana</option>
                      <option value="Hace 1-2 semanas">Hace 1-2 semanas</option>
                      <option value="Hace +1 mes">Hace más de un mes</option>
                    </select>
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!formData.title.trim()} 
                >
                  Guardar Vacante
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </>
  );
}