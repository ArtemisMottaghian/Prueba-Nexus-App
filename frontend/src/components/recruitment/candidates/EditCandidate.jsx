import { useState } from 'react';
import './EditCandidate.css';

export default function EditCandidate({ candidate, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: candidate?.name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    education: candidate?.education || '',
    location: candidate?.location || '',
    experience: candidate?.experience || '',
    specialty: candidate?.specialty || candidate?.skills || '',
    languages: candidate?.languages || '',
    linkedin: candidate?.linkedinUrl || '',
    github: candidate?.githubUrl || '',
    portfolio: candidate?.portfolioUrl || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Formateamos los datos tal y como los espera el backend
    const nameParts = formData.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    // El backend espera first_name/last_name y experience/skills como TEXTO,
    // y rechaza cadenas vacías en campos con formato. Enviamos solo lo que
    // tenga valor.
    const rawData = {
      first_name: firstName,
      last_name: lastName,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      education: formData.education,
      location: formData.location.trim(),
      experience: String(formData.experience || '').trim(),
      skills: formData.specialty.trim(),
      languages: formData.languages.trim(),
      linkedin_url: formData.linkedin.trim(),
      github_url: formData.github.trim(),
      portfolio_url: formData.portfolio.trim(),
    };
    const updatedData = Object.fromEntries(
      Object.entries(rawData).filter(
        ([, v]) => v !== '' && v !== null && v !== undefined
      )
    );

    try {
      await onSave(candidate.id, updatedData);
    } catch (err) {
      console.error('Fallo al guardar la edición:', err);
      // Si el backend da error, paramos el spinner para que no se quede "pillado"
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1055 }}></div>
      <div
        className="modal fade show d-block custom-create-modal"
        style={{ zIndex: 1060 }}
        tabIndex="-1"
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title fw-bold">
                <i className="bi bi-pencil-square me-2"></i>
                Editar Candidato
              </h4>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={isSubmitting}
              ></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Nombre Completo */}
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
                    required
                  />
                </div>

                {/* Contacto */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="email" className="form-label fw-semibold">
                      Email
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label htmlFor="phone" className="form-label fw-semibold">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      className="form-control"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Perfil */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="education"
                      className="form-label fw-semibold"
                    >
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
                      <option value="FP Grado Superior">
                        FP Grado Superior
                      </option>
                      <option value="Grado Universitario">
                        Grado Universitario
                      </option>
                      <option value="Máster">Máster</option>
                      <option value="Autodidacta">Autodidacta</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="experience"
                      className="form-label fw-semibold"
                    >
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
                      />
                      <span className="input-group-text">años</span>
                    </div>
                  </div>
                </div>

                {/* Localización y Habilidades */}
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
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="specialty" className="form-label fw-semibold">
                    Herramientas y Habilidades Específicas
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="specialty"
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleChange}
                  />
                  <div className="form-text">
                    Escribe las tecnologías o habilidades separadas por comas.
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="languages" className="form-label fw-semibold">
                    Idiomas
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="languages"
                    name="languages"
                    value={formData.languages}
                    onChange={handleChange}
                    placeholder="Ej: Español (nativo), Inglés (C1)..."
                  />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="linkedin"
                      className="form-label fw-semibold"
                    >
                      LinkedIn
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      id="linkedin"
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleChange}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label htmlFor="github" className="form-label fw-semibold">
                      GitHub
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      id="github"
                      name="github"
                      value={formData.github}
                      onChange={handleChange}
                      placeholder="https://github.com/..."
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="portfolio" className="form-label fw-semibold">
                    Portfolio / Web
                  </label>
                  <input
                    type="url"
                    className="form-control"
                    id="portfolio"
                    name="portfolio"
                    value={formData.portfolio}
                    onChange={handleChange}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.name.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Actualizar Candidato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
