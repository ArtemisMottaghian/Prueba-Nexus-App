import { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './CreateCandidate.css';

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─── Utilidad: extraer texto de un PDF ────────────────────────────────────────
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

// ─── Utilidad: parsear el texto del CV (optimizado para LinkedIn) ─────────────
function parseCVText(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // ── Nombre: LinkedIn siempre pone el nombre en la primera línea ──
  let name = '';
  const skipNamePatterns =
    /curriculum|cv\b|resume|perfil|experiencia|formación|education|summary|@|http|linkedin|teléfono|phone|\+\d/i;
  for (const line of lines.slice(0, 10)) {
    if (skipNamePatterns.test(line)) continue;
    if (/^\d/.test(line)) continue;
    if (line.length < 3 || line.length > 60) continue;
    const words = line.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 6 &&
      words.every((w) => /^[A-ZÁÉÍÓÚÜÑa-záéíóúüñ''-]+$/i.test(w))
    ) {
      name = line;
      break;
    }
  }

  // ── Localización: formato LinkedIn "Ciudad, Comunidad, País" ──
  let location = '';
  const locationLabelMatch = text.match(
    /(?:ubicación|localización|location|ciudad|city|dirección)[:\s]+([^\n·|]+)/i
  );
  if (locationLabelMatch) {
    // Quedarse solo con la ciudad (antes de la primera coma)
    location = locationLabelMatch[1].split(',')[0].trim();
  } else {
    const cities =
      /\b(Madrid|Barcelona|Valencia|Sevilla|Bilbao|Zaragoza|Málaga|Murcia|Alicante|Córdoba|Valladolid|Vigo|Granada|Oviedo|Vitoria|Coruña|Pamplona|Almería|Santander|Burgos|Toledo|León|Alcalá|Remoto|Remote)\b/i;
    const cityMatch = text.match(cities);
    if (cityMatch) location = cityMatch[1];
  }

  // ── Años de experiencia: suma las duraciones LinkedIn "· X años Y meses" ──
  let experience = '';
  let totalMonths = 0;
  const durationRegex =
    /·\s*(?:(\d+)\s*a(?:ño|no)s?\s*)?(?:(\d+)\s*mes(?:es)?)?/gi;
  let dMatch;
  while ((dMatch = durationRegex.exec(text)) !== null) {
    const yrs = parseInt(dMatch[1] || '0', 10);
    const mos = parseInt(dMatch[2] || '0', 10);
    if (yrs > 0 || mos > 0) totalMonths += yrs * 12 + mos;
  }
  if (totalMonths > 0) {
    experience = String(Math.round(totalMonths / 12));
  } else {
    // Fallback para CVs que escriben "X años de experiencia"
    const expFallbacks = [
      /(\d+)\+?\s*años?\s*(?:de\s*)?experiencia/i,
      /experiencia[:\s]+(\d+)\+?\s*años?/i,
      /(\d+)\+?\s*years?\s*(?:of\s*)?experience/i,
    ];
    for (const p of expFallbacks) {
      const m = text.match(p);
      if (m) {
        experience = m[1];
        break;
      }
    }
  }

  // ── Formación ──
  let education = '';
  const educationMap = [
    { pattern: /m[áa]ster\b|master\b|\bmsc\b/i, value: 'Máster' },
    {
      pattern:
        /grado universitario|grado en\b|ingenier[íi]a|licenciatura|arquitectura/i,
      value: 'Grado Universitario',
    },
    {
      pattern: /fp\s*grado\s*superior|cfgs|ciclo.*grado\s*superior/i,
      value: 'FP Grado Superior',
    },
    {
      pattern: /fp\s*grado\s*medio|cfgm|ciclo.*grado\s*medio/i,
      value: 'FP Grado Medio',
    },
    { pattern: /bootcamp/i, value: 'Bootcamp' },
    { pattern: /autodidacta|self.?taught/i, value: 'Autodidacta' },
  ];
  for (const { pattern, value } of educationMap) {
    if (pattern.test(text)) {
      education = value;
      break;
    }
  }

  // ── Habilidades: primero busca la sección "Aptitudes" de LinkedIn ──
  let skills = '';
  const aptitudesMatch = text.match(
    /aptitudes?(?:\s+principales?)?[\s\n:·]+([^\n].+?)(?=\n[A-ZÁÉÍÓÚ][a-záéíóúñ\s]{3,}\n|$)/is
  );
  if (aptitudesMatch) {
    const skillsList = aptitudesMatch[1]
      .split(/[\n,·•]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 50)
      .slice(0, 10);
    if (skillsList.length > 0) skills = skillsList.join(', ');
  }

  // Fallback: keywords tecnológicos si no encontró sección Aptitudes
  if (!skills) {
    const techKeywords = [
      'JavaScript',
      'TypeScript',
      'React',
      'Vue',
      'Angular',
      'Node.js',
      'Python',
      'Java',
      'PHP',
      'Laravel',
      'Django',
      'Flask',
      'SQL',
      'MySQL',
      'PostgreSQL',
      'MongoDB',
      'Docker',
      'Kubernetes',
      'AWS',
      'Azure',
      'GCP',
      'Git',
      'GitHub',
      'GitLab',
      'HTML',
      'CSS',
      'SCSS',
      'Tailwind',
      'Bootstrap',
      'REST',
      'GraphQL',
      'Figma',
      'Photoshop',
      'Illustrator',
      'Agile',
      'Scrum',
      'Jira',
      'Linux',
      'C#',
      'C++',
      'Go',
      'Swift',
      'Kotlin',
      'Spring',
      'Express',
      'Next.js',
      'Nuxt',
      'Redux',
      'Webpack',
      'Vite',
      'Firebase',
      'Redis',
      'Elasticsearch',
      'Kafka',
      'Liderazgo',
      'Comunicación',
    ];
    const found = techKeywords.filter((kw) =>
      new RegExp(
        `\\b${kw.replace(/\./g, '\\.').replace(/\+/g, '\\+')}\\b`,
        'i'
      ).test(text)
    );
    skills = found.slice(0, 10).join(', ');
  }

  return { name, location, experience, education, skills };
}

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
      const text = await extractTextFromPDF(file);
      const parsed = parseCVText(text);

      setFormData((prev) => ({
        name: parsed.name || prev.name,
        education: parsed.education || prev.education,
        location: parsed.location || prev.location,
        experience: parsed.experience || prev.experience,
        skills: parsed.skills || prev.skills,
      }));
      setCvExtracted(true);
    } catch (err) {
      console.error('Error al leer el CV:', err);
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
