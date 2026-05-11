import { useState, useEffect } from 'react';
import './EditCandidate.css';

export default function EditCandidate({ candidate, onClose, onSave }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    candidate_url: '',
    cv_url: '',
    location: '',
    experience: '',
    skills: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rellenamos el formulario con los datos actuales del candidato al abrirlo
  useEffect(() => {
    if (candidate) {
      // Separamos el nombre completo en nombre y apellidos por si acaso
      const nameParts = (candidate.name || '').split(' ');
      const fName = nameParts[0] || '';
      const lName = nameParts.slice(1).join(' ') || '';

      setFormData({
        first_name: fName,
        last_name: lName,
        email: candidate.email || '',
        phone: candidate.phone || '',
        candidate_url: candidate.candidate_url || '',
        cv_url: candidate.cv_url || '',
        location: candidate.location || '',
        experience: candidate.experience || '',
        skills: candidate.specialty || '', // En tu grid lo llamas specialty
        notes: candidate.notes || '',
      });
    }
  }, [candidate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const updatedData = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      candidate_url: formData.candidate_url.trim(),
      cv_url: formData.cv_url.trim(),
      skills: formData.skills.trim(),
      notes: formData.notes.trim(),
      location: formData.location.trim(),
      experience: formData.experience.trim(),
    };

    // Le pasamos el ID y los nuevos datos a la función padre
    await onSave(candidate.id, updatedData);
    setIsSubmitting(false);
  };

  const isFormValid =
    formData.first_name.trim() !== '' && formData.email.trim() !== '';

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
                {/* --- SECCIÓN: Datos Personales --- */}
                <h6 className="text-primary mb-3 border-bottom pb-2">
                  Datos Personales
                </h6>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">
                      Nombre <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">Apellidos</label>
                    <input
                      type="text"
                      className="form-control"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* --- SECCIÓN: Contacto --- */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">Teléfono</label>
                    <input
                      type="tel"
                      className="form-control"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Ubicación</label>
                  <input
                    type="text"
                    className="form-control"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                  />
                </div>

                {/* --- SECCIÓN: Perfil --- */}
                <h6 className="text-primary mt-4 mb-3 border-bottom pb-2">
                  Perfil Profesional
                </h6>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">
                      Experiencia
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">
                      Habilidades
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="skills"
                      value={formData.skills}
                      onChange={handleChange}
                    />
                  </div>
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
                  disabled={!isFormValid || isSubmitting}
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
