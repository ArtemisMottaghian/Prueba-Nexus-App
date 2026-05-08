import { useState, useRef } from 'react';
import { candidatesService } from '../../../services/candidatesService';
import './CreateCandidate.css';

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CreateCandidate({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    education: '',
    location: '',
    experience: '',
    skills: '',
  });

  const [isParsing, setIsParsing] = useState(false);
  const [cvFileName, setCvFileName] = useState('');
  const [cvExtracted, setCvExtracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Handlers de formulario ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const skillsArray = formData.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const newCandidateData = {
      name: formData.name.trim(),
      education: formData.education,
      location: formData.location.trim(),
      experience: formData.experience ? parseInt(formData.experience, 10) : 0,
      specialty: skillsArray.join(', '),
      skills: skillsArray,
      status: 'En proceso',
      isFavorite: false,
      verified: false,
    };
    onSave(newCandidateData);
  };

  // ── Handlers de CV ──
  const processCVFile = async (file) => {
    if (!file || file.type !== 'application/pdf') return;

    setIsParsing(true);
    setCvFileName(file.name);
    setCvExtracted(false);

    try {
      // El backend crea el candidato directamente y devuelve el objeto creado
      const createdCandidate = await candidatesService.processCV(file);
      // Llamamos a onSave con el candidato ya creado en BD para añadirlo a la lista
      onSave(createdCandidate);
    } catch (err) {
      console.error('Error al procesar el CV:', err);
      setCvFileName('');
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
    setFormData({
      name: '',
      education: '',
      location: '',
      experience: '',
      skills: '',
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

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* ── Zona de subida de CV ── */}
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
                  <div className="cv-parsing-state">
                    <div
                      className="spinner-border spinner-border-sm text-purple me-2"
                      role="status"
                    ></div>
                    <span>
                      Leyendo <strong>{cvFileName}</strong>…
                    </span>
                  </div>
                ) : cvExtracted ? (
                  <div className="cv-success-banner">
                    <div className="cv-success-left">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      <span>
                        Datos extraídos de <strong>{cvFileName}</strong> —
                        revisa y ajusta si es necesario
                      </span>
                    </div>
                    <button
                      type="button"
                      className="cv-clear-btn"
                      onClick={handleClearCV}
                      title="Quitar CV y limpiar formulario"
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                ) : null}

                <div className={cvFileName ? 'mt-3' : 'cv-divider'}>
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
                    {/* Formación */}
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

                    {/* Experiencia */}
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
                          placeholder="Ej. 3"
                        />
                        <span className="input-group-text">años</span>
                      </div>
                    </div>
                  </div>

                  {/* Localización */}
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
                      placeholder="Ej. Madrid, España (o 'Remoto')"
                    />
                  </div>

                  {/* Habilidades */}
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
                  disabled={!formData.name.trim() || isParsing}
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
