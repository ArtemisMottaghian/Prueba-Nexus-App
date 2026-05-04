import { useState, useEffect } from 'react';
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
  return {
    id: v.id,
    title: v.title || 'Oferta de empleo',
    companyName: v.company_name || null,
    location: v.location || 'No especificada',
    sector: v.sector || null,
    salaryMin: v.salary_min || null,
    salaryMax: v.salary_max || null,
    description: v.job_description || null,
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
  const mailSubject = encodeURIComponent(`Candidatura: ${job.title}`);
  const mailBody = encodeURIComponent(
    `Hola,\n\nMe pongo en contacto para postularme a la oferta "${job.title}"${job.companyName ? ` en ${job.companyName}` : ''}.\n\nAdjunto mi CV y quedo a vuestra disposición.\n\nSaludos.`
  );

  return (
    <div className="vpd-shell">
      {/* ── HEADER ─────────────────────────────────── */}
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
              <a
                href={`mailto:talento@ara-tech.es?subject=${mailSubject}&body=${mailBody}`}
                className="vpd-cta-btn"
              >
                <i className="bi bi-envelope-fill"></i>
                Enviar candidatura
              </a>
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
    </div>
  );
}
