import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ENDPOINTS } from '../../../services/api';
import './VacancyPublicDetail.css';

// ────────────────────────────────────────────────────────────
// Parser de descripción reutilizado de VacancyModal
// ────────────────────────────────────────────────────────────
function parseDescripcion(texto) {
  if (!texto) return [];

  const TITULOS_REGEX =
    /(Requisitos mínimos|Requisitos|Se valorará|Funciones|Se ofrece|Condiciones|Horario|Perfil)\s*:/gi;

  const normalizado = texto.replace(TITULOS_REGEX, '\n§§$1:\n');
  const trozos = normalizado
    .split('\n§§')
    .map((t) => t.trim())
    .filter(Boolean);

  return trozos.map((trozo) => {
    const matchTitulo = trozo.match(/^([^:\n]{3,40}):\s*/);
    const titulo = matchTitulo ? matchTitulo[1].trim() : null;
    const cuerpo = matchTitulo ? trozo.slice(matchTitulo[0].length) : trozo;
    const partes = cuerpo
      .split('·')
      .map((p) => p.trim())
      .filter(Boolean);

    if (partes.length > 1) {
      return {
        titulo,
        intro:
          partes[0].endsWith(':') || partes[0].endsWith('.') ? partes[0] : null,
        bullets:
          partes[0].endsWith(':') || partes[0].endsWith('.')
            ? partes.slice(1)
            : partes,
      };
    }
    return { titulo, intro: cuerpo, bullets: [] };
  });
}

// ────────────────────────────────────────────────────────────
// Mapea la respuesta del endpoint público al modelo de UI
// ────────────────────────────────────────────────────────────
function mapPublicVacancy(v) {
  const str = (val) =>
    typeof val === 'string' ? val : val ? String(val) : null;
  return {
    id: v.id,
    title: str(v.title) || 'Oferta de empleo',
    companyName: str(v.company_name) || null,
    location: str(v.location) || 'No especificada',
    sector: str(v.sector) || null,
    salaryMin: v.salary_min || null,
    salaryMax: v.salary_max || null,
    description: str(v.job_description) || null,
    publishedAt: v.published_at
      ? new Date(v.published_at).toLocaleDateString('es-ES')
      : null,
  };
}

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────
export default function VacancyPublicDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
    location: '',
    experience: '',
    specialty: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [cvFileName, setCvFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [cvExtracted, setCvExtracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Issue #452: inyectar <meta name="robots" content="noindex, nofollow">
  // para que Google no indexe estas ofertas y la competencia no las detecte.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  // ── Carga de datos sin autenticación (endpoint público)
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    const fetchVacancy = async () => {
      try {
        // Intenta el endpoint público específico
        const res = await fetch(ENDPOINTS.recruitment.vacantes.public(id), {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setJob(mapPublicVacancy(data));
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(
          'No se ha podido cargar la oferta. Por favor, inténtalo más tarde.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchVacancy();
    return () => controller.abort();
  }, [id]);

  // ── Formateo del rango salarial
  const salarioLabel = (() => {
    if (!job) return 'A convenir';
    const fmt = (n) => Number(n).toLocaleString('es-ES');
    if (job.salaryMin && job.salaryMax)
      return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)} €/año`;
    if (job.salaryMin) return `Desde ${fmt(job.salaryMin)} €/año`;
    if (job.salaryMax) return `Hasta ${fmt(job.salaryMax)} €/año`;
    return 'A convenir';
  })();

  // ── Estado: cargando
  if (loading) {
    return (
      <div className="vpd-shell">
        <div className="vpd-loading">
          <div className="vpd-spinner"></div>
          <p>Cargando oferta…</p>
        </div>
      </div>
    );
  }

  // ── Estado: error o vacante no encontrada
  if (error || !job) {
    return (
      <div className="vpd-shell">
        <div className="vpd-error">
          <i className="bi bi-exclamation-triangle vpd-error-icon"></i>
          <h2>Oferta no disponible</h2>
          <p>{error || 'Esta oferta no existe o ha sido retirada.'}</p>
        </div>
      </div>
    );
  }

  const secciones = parseDescripcion(job.description);

  const processCVFile = async (file) => {
    if (!file || file.type !== 'application/pdf') return;
    setIsParsing(true);
    setErrorStatus(null);
    setCvFileName(file.name);
    setCvExtracted(false);
    try {
      const formDataCV = new FormData();
      formDataCV.append('pdf_file', file);
      const res = await fetch('/api/candidates/process_cv', {
        method: 'POST',
        body: formDataCV,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setFormData({
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        email: data.email || '',
        phone: data.phone || '',
        education:
          typeof data.education === 'object' ? '' : data.education || '',
        location: data.location || '',
        experience:
          typeof data.experience === 'object' ? '' : data.experience || '',
        specialty:
          data.specialty ||
          (Array.isArray(data.skills) ? data.skills.join(', ') : data.skills) ||
          '',
      });
      setCvExtracted(true);
    } catch (err) {
      setErrorStatus(`Error al procesar PDF: ${err.message}`);
      setCvFileName('');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="vpd-shell">
      {/* ── HEADER */}
      <header className="vpd-header">
        <div className="vpd-header-inner">
          <span className="vpd-logo-brand">
            Nexus<span>AI</span>
          </span>
          <a href="#vpd-apply" className="vpd-apply-btn-header">
            Inscribirme en la oferta
          </a>
        </div>
      </header>
      {/* ── HERO ───────────────────────────────────── */}
      <section className="vpd-hero">
        <div className="vpd-container">
          <div className="vpd-company-avatar">
            {(job.companyName || job.title || '?').charAt(0).toUpperCase()}
          </div>
          <div className="vpd-hero-info">
            <h1 className="vpd-title">{job.title}</h1>
            {job.companyName && (
              <p className="vpd-company">{job.companyName}</p>
            )}
            <div className="vpd-meta-row">
              <span className="vpd-meta-chip">
                <i className="bi bi-geo-alt-fill"></i>
                {job.location}
              </span>
              {job.sector && (
                <span className="vpd-meta-chip">
                  <i className="bi bi-briefcase-fill"></i>
                  {job.sector}
                </span>
              )}
              <span className="vpd-meta-chip vpd-meta-chip--salary">
                <i className="bi bi-cash-stack"></i>
                {salarioLabel}
              </span>
              {job.publishedAt && (
                <span className="vpd-meta-chip vpd-meta-chip--date">
                  <i className="bi bi-calendar3"></i>
                  Publicado el {job.publishedAt}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── BODY ───────────────────────────────────── */}
      <main className="vpd-body">
        <div className="vpd-container vpd-body-layout">
          {/* Columna principal — descripción del puesto */}
          <section className="vpd-main-col">
            <div className="vpd-card">
              <h2 className="vpd-section-title">Descripción del puesto</h2>
              {secciones.length > 0 ? (
                secciones.map((s, i) => (
                  <div key={i} className="vpd-desc-block">
                    {s.titulo && (
                      <h3 className="vpd-desc-subtitle">{s.titulo}</h3>
                    )}
                    {s.intro && <p className="vpd-desc-intro">{s.intro}</p>}
                    {s.bullets.length > 0 && (
                      <ul className="vpd-desc-list">
                        {s.bullets.map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                <p className="vpd-no-desc">
                  Descripción detallada no disponible actualmente.
                </p>
              )}
            </div>
          </section>

          {/* Columna lateral — ficha resumen + CTA */}
          <aside className="vpd-side-col">
            {/* Ficha informativa */}
            <div className="vpd-card vpd-info-card">
              <h2 className="vpd-section-title">Detalles del puesto</h2>
              <ul className="vpd-info-list">
                {job.companyName && (
                  <li>
                    <span className="vpd-info-icon">
                      <i className="bi bi-building"></i>
                    </span>
                    <div>
                      <div className="vpd-info-label">Empresa</div>
                      <div className="vpd-info-value">{job.companyName}</div>
                    </div>
                  </li>
                )}
                <li>
                  <span className="vpd-info-icon">
                    <i className="bi bi-geo-alt-fill"></i>
                  </span>
                  <div>
                    <div className="vpd-info-label">Ubicación</div>
                    <div className="vpd-info-value">{job.location}</div>
                  </div>
                </li>
                {job.sector && (
                  <li>
                    <span className="vpd-info-icon">
                      <i className="bi bi-briefcase-fill"></i>
                    </span>
                    <div>
                      <div className="vpd-info-label">Sector</div>
                      <div className="vpd-info-value">{job.sector}</div>
                    </div>
                  </li>
                )}
                <li>
                  <span className="vpd-info-icon">
                    <i className="bi bi-cash-stack"></i>
                  </span>
                  <div>
                    <div className="vpd-info-label">Salario</div>
                    <div className="vpd-info-value">{salarioLabel}</div>
                  </div>
                </li>
              </ul>
            </div>

            {/* CTA — Inscripción */}
            <div className="vpd-card vpd-cta-card" id="vpd-apply">
              <i className="bi bi-send-fill vpd-cta-icon"></i>
              <h3 className="vpd-cta-title">¿Te interesa esta oferta?</h3>
              <p className="vpd-cta-desc">
                Envíanos tu candidatura y nos pondremos en contacto contigo lo
                antes posible.
              </p>
              <button className="vpd-cta-btn" onClick={() => setShowForm(true)}>
                <i className="bi bi-envelope-fill"></i>
                Enviar candidatura
              </button>
              <p className="vpd-cta-note">
                Gestionada por <strong>Nexus Talent Solutions</strong>
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* ── FOOTER ─────────────────────────────────── */}
      <footer className="vpd-footer">
        <div className="vpd-container">
          <p>
            © {new Date().getFullYear()} <strong>NexusAI</strong> — Powered by
            Ara-Tech Solutions
          </p>
          <p className="vpd-footer-note">
            Esta oferta es confidencial y no está indexada por motores de
            búsqueda.
          </p>
        </div>
      </footer>

      {showForm && (
        <div className="vpd-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="vpd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vpd-modal-header">
              <h3>Enviar candidatura</h3>
              <button
                className="vpd-modal-close"
                onClick={() => setShowForm(false)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="vpd-modal-body">
              {formStatus === 'ok' ? (
                <div className="vpd-form-success">
                  <i className="bi bi-check-circle-fill"></i>
                  <p>¡Candidatura enviada correctamente!</p>
                  <p>Nos pondremos en contacto contigo pronto.</p>
                </div>
              ) : (
                <>
                  {/* Zona subida CV */}
                  {!cvFileName ? (
                    <div
                      className={`vpd-cv-zone ${isDragging ? 'vpd-cv-zone--drag' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        processCVFile(e.dataTransfer.files?.[0]);
                      }}
                    >
                      <i className="bi bi-file-earmark-pdf vpd-cv-icon"></i>
                      <span className="vpd-cv-label">
                        Subir CV en PDF para autocompletar
                      </span>
                      <span className="vpd-cv-hint">
                        Haz clic o arrastra aquí el archivo
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => processCVFile(e.target.files?.[0])}
                      />
                    </div>
                  ) : isParsing ? (
                    <div className="vpd-cv-parsing">
                      <div className="vpd-cv-spinner"></div>
                      <span>
                        Extrayendo datos de <strong>{cvFileName}</strong>...
                      </span>
                    </div>
                  ) : cvExtracted ? (
                    <div className="vpd-cv-success">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>
                        Datos extraídos — Revisa los campos antes de guardar.
                      </span>
                      <button
                        onClick={() => {
                          setCvFileName('');
                          setCvExtracted(false);
                          setFormData({
                            name: '',
                            email: '',
                            phone: '',
                            education: '',
                            location: '',
                            experience: '',
                            specialty: '',
                          });
                          if (fileInputRef.current)
                            fileInputRef.current.value = '';
                        }}
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  ) : null}

                  {errorStatus && (
                    <div className="vpd-form-error">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      {errorStatus}
                    </div>
                  )}
                  <div className="vpd-form-field">
                    <label>NOMBRE COMPLETO *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Tu nombre completo"
                    />
                  </div>
                  <div className="vpd-form-row">
                    <div className="vpd-form-field">
                      <label>EMAIL</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="tu@email.com"
                      />
                    </div>
                    <div className="vpd-form-field">
                      <label>TELÉFONO</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="6XX XXX XXX"
                      />
                    </div>
                  </div>
                  <div className="vpd-form-row">
                    <div className="vpd-form-field">
                      <label>FORMACIÓN / TITULACIÓN</label>
                      <select
                        value={
                          typeof formData.education === 'string'
                            ? formData.education
                            : ''
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            education: e.target.value,
                          })
                        }
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
                    <div className="vpd-form-field">
                      <label>AÑOS DE EXPERIENCIA</label>
                      <input
                        type="number"
                        value={String(formData.experience || '')}
                        min="0"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            experience: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="vpd-form-field">
                    <label>LOCALIZACIÓN</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="Ciudad, País"
                    />
                  </div>
                  <div className="vpd-form-field">
                    <label>HERRAMIENTAS Y HABILIDADES ESPECÍFICAS</label>
                    <input
                      type="text"
                      value={
                        Array.isArray(formData.specialty)
                          ? formData.specialty.join(', ')
                          : formData.specialty || ''
                      }
                      onChange={(e) =>
                        setFormData({ ...formData, specialty: e.target.value })
                      }
                      placeholder="Ej: React, Node, SQL..."
                    />
                  </div>
                  <div className="vpd-form-actions">
                    <button
                      className="vpd-btn-cancel"
                      onClick={() => setShowForm(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="vpd-btn-submit"
                      disabled={!formData.name.trim() || isSubmitting}
                      onClick={async () => {
                        setIsSubmitting(true);
                        setErrorStatus(null);
                        const nameParts = formData.name.trim().split(' ');
                        try {
                          const res = await fetch('/api/candidates/public', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              first_name: nameParts[0] || '',
                              last_name: nameParts.slice(1).join(' ') || '-',
                              email:
                                formData.email || `${Date.now()}@nexus.local`,
                              phone: formData.phone || '000000000',
                              location: formData.location || 'España',
                              education: formData.education || '',
                              experience: parseInt(formData.experience) || 0,
                              specialty: formData.specialty || '',
                              skills: formData.specialty
                                ? formData.specialty
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : [],
                              source: `Vacante pública #${id}`,
                            }),
                          });
                          if (res.ok) setFormStatus('ok');
                          else {
                            const err = await res.json();
                            setErrorStatus(
                              err.detail || 'Error al enviar la candidatura.'
                            );
                          }
                        } catch {
                          setErrorStatus(
                            'Error de conexión. Inténtalo de nuevo.'
                          );
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                    >
                      {isSubmitting ? 'Enviando...' : 'Guardar Candidato'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
