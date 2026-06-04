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
  const [errorStatus, setErrorStatus] = useState(null);

  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorStatus(null);

    const expNumber = formData.experience
      ? parseInt(formData.experience, 10)
      : 0;
    const skillsArray = formData.specialty
      ? formData.specialty
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const nameParts = formData.name.trim().split(' ');
    const fName = nameParts[0] || '';
    const lName = nameParts.slice(1).join(' ') || '';

    const finalData = {
      first_name: fName,
      last_name: lName,
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

      onSave({
        ...finalCandidate,
        name: formData.name.trim(),
        specialty: finalData.specialty,
        experience: expNumber,
      });
    } catch (error) {
      console.error('Error al guardar el candidato:', error);

      let msg = 'No se ha podido guardar el candidato. Inténtalo de nuevo.';

      if (
        error.message.includes('already exists') ||
        error.message.includes('duplicate')
      ) {
        msg =
          '¡Error! Ya existe un candidato registrado con este mismo correo electrónico.';
      } else {
        try {
          const rawMessage = error.message;
          if (
            rawMessage &&
            (rawMessage.startsWith('[') || rawMessage.startsWith('{'))
          ) {
            const parsedErrors = JSON.parse(rawMessage);
            if (Array.isArray(parsedErrors)) {
              msg =
                'Campos incorrectos: ' +
                parsedErrors
                  .map((err) => `${err.loc?.[1] || 'campo'}: ${err.msg}`)
                  .join(' | ');
            }
          } else {
            msg = `Error del servidor: ${error.message}`;
          }
        } catch (e) {
          console.warn(
            'La respuesta de error no contenía un JSON de validación:',
            e
          );
          msg = `Error del servidor: ${error.message || 'Error desconocido'}`;
        }
      }

      setErrorStatus(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const processCVFile = async (file) => {
    if (!file || file.type !== 'application/pdf') return;

    setIsParsing(true);
    setErrorStatus(null);
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

      let msg = 'No hemos podido leer este PDF correctamente.';
      if (
        err.message.includes('already exists') ||
        err.message.includes('duplicate')
      ) {
        msg =
          '¡Este candidato ya existe! El email de este PDF ya está en la base de datos.';
      } else if (err.message.includes('413')) {
        msg = 'El archivo PDF es demasiado grande para procesarlo.';
      } else {
        msg = `Error al procesar PDF: ${err.message}`;
      }

      setErrorStatus(msg);
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
    setErrorStatus(null);
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
      <div className="modal-backdrop fade show" style={{ zIndex: 1055 }}></div>
      <div
        className="modal fade show d-block custom-create-modal"
        style={{ zIndex: 1060 }}
        tabIndex="-1"
        role="dialog"
      >
        {/* 
          CAMBIO CLAVE: eliminado "modal-dialog-scrollable" — interfería con nuestro
          flex propio. El scroll lo gestiona ahora el CSS en .modal-body.
        */}
        <div className="modal-dialog modal-dialog-centered modal-lg">
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

            <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
              <div className="modal-body">
                {/* Banner de error */}
                {errorStatus && (
                  <div
                    className="alert alert-danger d-flex align-items-center animate__animated animate__shakeX"
                    role="alert"
                  >
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <div>{errorStatus}</div>
                  </div>
                )}

                {/* Zona de carga de PDF */}
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
                        Datos extraídos con éxito — Revisa los campos antes de
                        guardar.
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

                <div
                  className={
                    cvFileName || errorStatus ? 'mt-3' : 'cv-divider mt-4'
                  }
                >
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
                      placeholder="Ej: React, Node, SQL..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
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
