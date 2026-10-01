import { useState, useRef, useEffect } from 'react';
import { candidatesService } from '../../../services/candidatesService';
import './CreateCandidate.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mismo formato que exige el backend para el teléfono
const PHONE_RE = /^\+?[\d\s-]{7,20}$/;

// El backend exige nombre y apellido (mín. 2 letras cada uno) y email válido.
// Lo comprobamos antes de enviar para avisar campo a campo.
function validateForm({ name, email, phone }, existingEmails) {
  const errors = {};

  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  if (firstName.length < 2 || lastName.length < 2) {
    errors.name = 'Escribe nombre y apellido (mínimo 2 letras cada uno).';
  }

  if (!email.trim()) {
    errors.email = 'El email es obligatorio.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'El email no tiene un formato válido.';
  } else if (existingEmails?.has(email.trim().toLowerCase())) {
    errors.email = 'Ya existe un candidato con este email.';
  }

  if (phone.trim() && !PHONE_RE.test(phone.trim())) {
    errors.phone =
      'Teléfono no válido: entre 7 y 20 caracteres, solo números, espacios, guiones y un + inicial.';
  }

  return errors;
}

export default function CreateCandidate({ onClose, onSave, existingEmails }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
    location: '',
    experience: '',
    specialty: '',
    languages: '',
    profile: '',
  });

  const [isParsing, setIsParsing] = useState(false);
  const [cvFileName, setCvFileName] = useState('');
  const [cvExtracted, setCvExtracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedCandidateId, setParsedCandidateId] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [consentMensaje, setConsentMensaje] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const fileInputRef = useRef(null);
  const errorBannerRef = useRef(null);
  // El estado `isSubmitting` se actualiza de forma asíncrona: un doble clic
  // rápido (o Intro) podría lanzar dos envíos. Este cerrojo es síncrono.
  const submittingRef = useRef(false);

  // Si el error aparece arriba y el usuario está abajo del formulario, lo traemos a la vista
  useEffect(() => {
    if (errorStatus) {
      errorBannerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [errorStatus]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || isParsing) return;

    // Con un CV ya procesado el candidato existe (se actualiza), no se comprueba duplicado
    const errors = validateForm(
      formData,
      parsedCandidateId ? null : existingEmails
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorStatus('Revisa los campos marcados en rojo antes de guardar.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorStatus(null);

    const nameParts = formData.name.trim().split(/\s+/);
    const fName = nameParts[0] || '';
    const lName = nameParts.slice(1).join(' ') || '';

    // El backend espera experience/skills como TEXTO y rechaza cadenas
    // vacías en campos con formato (p. ej. phone). Enviamos solo lo que
    // tenga valor.
    const rawData = {
      first_name: fName,
      last_name: lName,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      education: formData.education,
      location: formData.location.trim(),
      experience: String(formData.experience || '').trim(),
      skills: formData.specialty.trim(),
      languages: formData.languages.trim(),
      profile: formData.profile.trim(),
    };
    const finalData = Object.fromEntries(
      Object.entries(rawData).filter(
        ([, v]) => v !== '' && v !== null && v !== undefined
      )
    );

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
        specialty: formData.specialty.trim(),
        experience: formData.experience,
      });
    } catch (error) {
      console.error('Error al guardar el candidato:', error);

      // El servicio ya devuelve el motivo en un texto legible
      const reason = error?.message || '';
      let msg = 'No se ha podido guardar el candidato. Inténtalo de nuevo.';

      if (reason.includes('already exists') || reason.includes('duplicate')) {
        msg =
          '¡Error! Ya existe un candidato registrado con este mismo correo electrónico.';
      } else if (reason) {
        msg = `No se ha podido guardar el candidato: ${reason}`;
      }

      setErrorStatus(msg);
    } finally {
      submittingRef.current = false;
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
      const res = await candidatesService.processCV(file);
      setConsentMensaje(res?.mensaje || 'CV procesado correctamente.');

      // Rellenar el formulario con lo extraido del CV para poder revisarlo.
      // Al guardar, como ya existe el candidato (parsedCandidateId), se actualiza.
      const c = res?.candidato;
      if (c) {
        setFormData({
          name: [c.first_name, c.last_name].filter(Boolean).join(' '),
          email: c.email || '',
          phone: c.phone || '',
          education: c.education || '',
          location: c.location || '',
          experience: c.experience || '',
          specialty: c.skills || '',
          languages: c.languages || '',
          profile: c.profile || '',
        });
      }
      if (res?.id) setParsedCandidateId(res.id);
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
    setConsentMensaje('');
    setParsedCandidateId(null);
    setFieldErrors({});
    setFormData({
      name: '',
      email: '',
      phone: '',
      education: '',
      location: '',
      experience: '',
      specialty: '',
      languages: '',
      profile: '',
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
        <div className="modal-dialog modal-dialog-centered modal-lg candidate-form-dialog">
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

            <form
              onSubmit={handleSubmit}
              noValidate
              style={{ display: 'contents' }}
            >
              <div className="modal-body">
                {/* Banner de error */}
                {errorStatus && (
                  <div
                    ref={errorBannerRef}
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
                      <span>{consentMensaje}</span>
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
                      className={`form-control ${fieldErrors.name ? 'is-invalid' : ''}`}
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                    {fieldErrors.name && (
                      <div className="invalid-feedback">{fieldErrors.name}</div>
                    )}
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="email" className="form-label fw-semibold">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                      {fieldErrors.email && (
                        <div className="invalid-feedback">
                          {fieldErrors.email}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="phone" className="form-label fw-semibold">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        className={`form-control ${fieldErrors.phone ? 'is-invalid' : ''}`}
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                      {fieldErrors.phone && (
                        <div className="invalid-feedback">
                          {fieldErrors.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="profile" className="form-label fw-semibold">
                      Perfil (resumen)
                    </label>
                    <textarea
                      className="form-control"
                      id="profile"
                      name="profile"
                      rows="2"
                      value={formData.profile}
                      onChange={handleChange}
                      placeholder="Resumen profesional de 1-2 frases"
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="education"
                      className="form-label fw-semibold"
                    >
                      Formación académica
                    </label>
                    <textarea
                      className="form-control"
                      id="education"
                      name="education"
                      rows="3"
                      value={formData.education}
                      onChange={handleChange}
                      placeholder={
                        'Una titulación por línea. Ej:\nGrado en Trabajo Social\nMáster Full Stack Developer'
                      }
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="experience"
                      className="form-label fw-semibold"
                    >
                      Experiencia profesional
                    </label>
                    <textarea
                      className="form-control"
                      id="experience"
                      name="experience"
                      rows="4"
                      value={formData.experience}
                      onChange={handleChange}
                      placeholder={
                        'Un puesto por línea. Ej:\nMediadora Social - Cruz Roja Española (2023-2024)'
                      }
                    />
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

                  <div className="mb-3">
                    <label
                      htmlFor="languages"
                      className="form-label fw-semibold"
                    >
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
