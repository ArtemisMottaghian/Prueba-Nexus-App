import { useState } from 'react';
import './CreateCandidate.css';

export default function CreateCandidate({ onClose, onSave }) {
  // 1. Estado inicial del formulario
  const [formData, setFormData] = useState({
    name: '',
    education: '',
    location: '',
    experience: '',
    skills: '' // Lo manejamos como un texto separado por comas para que sea fácil de escribir
  });

  // 2. Manejador para actualizar el estado cuando el usuario escribe
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // 3. Lógica al enviar el formulario
  const handleSubmit = (e) => {
    e.preventDefault(); // Evita que la página se recargue

    // Limpiamos las habilidades (skills): convertimos el texto en un array
    const skillsArray = formData.skills
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => skill !== '');

    // Preparamos el objeto final que se enviará al componente padre
    const newCandidateData = {
      name: formData.name.trim(),
      education: formData.education,
      location: formData.location.trim(),
      // Nos aseguramos de que la experiencia sea un número
      experience: formData.experience ? parseInt(formData.experience, 10) : 0, 
      specialty: skillsArray.join(', '), // Opcional: para que se vea en tu lista actual
      skills: skillsArray,
      status: 'En proceso', // Estado por defecto para un nuevo candidato
      isFavorite: false,
      verified: false
    };

    onSave(newCandidateData);
  };

  return (
    <>
      {/* Fondo oscuro del modal */}
      <div className="modal-backdrop fade show"></div>
      
      {/* Contenedor principal del modal */}
      {/* 2. Añadimos la clase 'custom-create-modal' para que aplique nuestro CSS */}
      <div className="modal fade show d-block custom-create-modal" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            
            <div className="modal-header">
              <h4 className="modal-title fw-bold">Añadir Nuevo Candidato</h4>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
                aria-label="Cerrar"
              ></button>
            </div>

            {/* Usamos la etiqueta <form> para que funcione el 'Enter' y las validaciones de HTML5 */}
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                {/* Nombre */}
                <div className="mb-3">
                  <label htmlFor="name" className="form-label fw-semibold">
                    Nombre Completo <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej. Carlos Mendoza"
                    required
                  />
                </div>

                <div className="row">
                  {/* Formación / Titulación */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="education" className="form-label fw-semibold">
                      Formación / Titulación
                    </label>
                    <select
                      className="form-select"
                      id="education"
                      name="education"
                      value={formData.education}
                      onChange={handleChange}
                    >
                      <option value="">Selecciona una opción...</option>
                      <option value="Bootcamp">Bootcamp</option>
                      <option value="FP Grado Medio">FP Grado Medio</option>
                      <option value="FP Grado Superior">FP Grado Superior</option>
                      <option value="Grado Universitario">Grado Universitario</option>
                      <option value="Máster">Máster</option>
                      <option value="Autodidacta">Autodidacta</option>
                    </select>
                  </div>

                  {/* Años de Experiencia */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="experience" className="form-label fw-semibold">
                      Años de experiencia
                    </label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        id="experience"
                        name="experience"
                        value={formData.experience}
                        onChange={handleChange}
                        min="0"
                        placeholder="Ej. 3"
                      />
                      <span className="input-group-text">años</span>
                    </div>
                  </div>
                </div>

                {/* Localización */}
                <div className="mb-3">
                  <label htmlFor="location" className="form-label fw-semibold">
                    Localización
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Ej. Madrid, España (o 'Remoto')"
                  />
                </div>

                {/* Herramientas / Habilidades */}
                <div className="mb-3">
                  <label htmlFor="skills" className="form-label fw-semibold">
                    Herramientas y Habilidades Específicas
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="skills"
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                    placeholder="Ej. React, Node.js, Figma, Liderazgo"
                  />
                  <div className="form-text">
                    Escribe las tecnologías o habilidades separadas por comas.
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
                  // Deshabilitar el botón si no hay nombre
                  disabled={!formData.name.trim()} 
                >
                  Guardar Candidato
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </>
  );
}