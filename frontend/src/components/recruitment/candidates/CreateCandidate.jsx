import { useState, useRef } from 'react';
import { candidatesService } from '../../../services/candidatesService';
import './CreateCandidate.css';

export default function CreateCandidate({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
    location: '',
    experience: '',
    specialty: '',
  });

  const [isParsing, setIsParsing] = useState(false);
  const [cvFileName, setCvFileName] = useState('');
  const [cvExtracted, setCvExtracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedCandidateId, setParsedCandidateId] = useState(null);

  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const expNumber = formData.experience
      ? parseInt(formData.experience, 10)
      : 0;
    const skillsArray = formData.specialty
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const finalData = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      education: formData.education,
      location: formData.location.trim(),
      experience: expNumber,
      specialty: formData.specialty.trim(),
      skills: skillsArray,
    };

    try {
      let finalCandidate;
      if (parsedCandidateId) {
        finalCandidate = await candidatesService.updateCandidate(
          parsedCandidateId,
          finalData
        );
      } else {
        finalCandidate = await candidatesService.createCandidate(finalData);
      }

      // Aseguramos el cruce correcto para la tarjeta visual
      finalCandidate.name = finalData.name;
      finalCandidate.specialty = finalData.specialty;

      onSave(finalCandidate);
    } catch (error) {
      console.error('Error al guardar el candidato:', error);
      alert('Hubo un error al guardar el candidato. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processCVFile = async (file) => {
    if (!file || file.type !== 'application/pdf') return;

    setIsParsing(true);
    setCvFileName(file.name);
    setCvExtracted(false);

    try {
      const createdCandidate = await candidatesService.processCV(file);

      setFormData({
        name: createdCandidate.name || '',
        email: createdCandidate.email || '',
        phone: createdCandidate.phone || '',
        education: createdCandidate.education || '',
        location: createdCandidate.location || '',
        experience: createdCandidate.experience || '',
        specialty: createdCandidate.specialty || createdCandidate.skills || '',
      });

      setParsedCandidateId(createdCandidate.id);
      setCvExtracted(true);
    } catch (err) {
      console.error('Error al procesar el CV:', err);
      // AHORA LA ALERTA NOS DIRÁ EL ERROR REAL DEL SERVIDOR 👇
      alert(
        `Hubo un problema procesando el PDF: ${err.message}\n\nPuedes rellenar los datos manualmente.`
      );
      setCvFileName('');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processCVFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCVFile(file);
  };

  const handleClearCV = () => {
    setCvFileName('');
    setCvExtracted(false);
    setParsedCandidateId(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      education: '',
      location: '',
      experience: '',
      specialty: '',
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div
        className="modal fade show d-block custom-create-modal"
        tabIndex="-1"
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title fw-bold">Añadir Nuevo Candidato</h4>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={isParsing || isSubmitting}
              ></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {!cvFileName ? (
                  <div
                    className={`cv-upload-zone ${isDragging ? 'cv-upload-zone--drag' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <i className="bi bi-file-earmark-pdf cv-upload-icon"></i>
                    <span className="cv-upload-label">
                      Subir CV en PDF para autocompletar
                    </span>
                    <span className="cv-upload-hint">
                      Haz clic o arrastra aquí el archivo
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="d-none"
                      onChange={handleFileChange}
                    />
                  </div>
                ) : isParsing ? (
                  <div className="cv-parsing-state text-center p-4 bg-light rounded border">
                    <div
                      className="spinner-border text-primary me-2 mb-2"
                      role="status"
                    ></div>
                    <div className="text-muted">
                      Extrayendo datos de <strong>{cvFileName}</strong>...
                    </div>
                  </div>
                ) : cvExtracted ? (
                  <div className="cv-success-banner d-flex justify-content-between align-items-center p-3 mb-4 bg-success-subtle text-success rounded border border-success">
                    <div className="cv-success-left">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      <span>
                        Datos extraídos de <strong>{cvFileName}</strong> —
                        Revisa los campos.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger border-0"
                      onClick={handleClearCV}
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                ) : null}

                <div className={cvFileName ? '' : 'cv-divider mt-4'}>
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

                  <div className="mb-3">
                    <label
                      htmlFor="location"
                      className="form-label fw-semibold"
                    >
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
                    <label
                      htmlFor="specialty"
                      className="form-label fw-semibold"
                    >
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
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={isParsing || isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.name.trim() || isParsing || isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Candidato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
