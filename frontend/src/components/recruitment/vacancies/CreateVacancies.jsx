import { useState, useEffect, useMemo } from 'react';
import './CreateVacancies.css';
import { LISTA_SECTORES } from '../../../utils/sectores';
import { EMPRESAS_DESTACADAS } from '../../../utils/empresasDestacadas';
import { vacanciesService } from '../../../services/vacanciesService';

// clave normalizada para comparar/deduplicar nombres de empresa
const normalizarEmp = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// "Publicada hace..." -> nº de días hacia atrás
const DIAS_PUBLICACION = {
  Hoy: 0,
  Ayer: 1,
  'Esta semana': 3,
  'Hace 1-2 semanas': 10,
  'Hace +1 mes': 35,
};

// "35.000€ - 45.000€" -> { salary_min: 35000, salary_max: 45000 }
function parseSalario(rango) {
  const nums = (String(rango).match(/\d[\d.]*/g) || [])
    .map((s) => parseInt(s.replace(/\./g, ''), 10))
    .filter((n) => !isNaN(n));
  return { salary_min: nums[0] ?? null, salary_max: nums[1] ?? null };
}

function publicadaHaceAFecha(etiqueta) {
  if (!etiqueta) return null;
  const dias = DIAS_PUBLICACION[etiqueta] ?? 0;
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

export default function CreateVacancy({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    sector: '',
    source: '',
    salaryRange: '',
    companyName: '',
    publishedAgo: '',
  });
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showEmpresas, setShowEmpresas] = useState(false);

  // Cargar los nombres de empresas ya registradas (para el selector con dedup)
  useEffect(() => {
    vacanciesService
      .getCompanies()
      .then(setCompanies)
      .catch(() => {});
  }, []);

  // Empresas de la BD + grandes empleadoras precargadas, sin duplicados y ordenadas.
  const empresasTodas = useMemo(() => {
    const vistas = new Set();
    const out = [];
    for (const c of [...companies, ...EMPRESAS_DESTACADAS]) {
      const k = normalizarEmp(c);
      if (!k || vistas.has(k)) continue;
      vistas.add(k);
      out.push(c);
    }
    return out.sort((a, b) => a.localeCompare(b, 'es'));
  }, [companies]);

  // Filtro del buscador (muestra hasta 50 coincidencias).
  const empresasFiltradas = useMemo(() => {
    const q = normalizarEmp(formData.companyName);
    const base = q
      ? empresasTodas.filter((c) => normalizarEmp(c).includes(q))
      : empresasTodas;
    return base.slice(0, 50);
  }, [empresasTodas, formData.companyName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { salary_min, salary_max } = parseSalario(formData.salaryRange);

    const payload = {
      title: formData.title.trim(),
      company_name: formData.companyName.trim() || null,
      location: formData.location.trim() || null,
      sector: formData.sector || null,
      source: formData.source || 'Carga Manual',
      salary_min,
      salary_max,
      published_at: publicadaHaceAFecha(formData.publishedAgo),
    };

    try {
      setSaving(true);
      await onSave(payload); // el padre persiste y cierra el modal si va bien
    } finally {
      setSaving(false);
    }
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
              <h4 className="modal-title fw-bold">Añadir Nueva Vacante</h4>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label="Cerrar"
              ></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* 1. Nombre de la Vacante */}
                <div className="mb-4">
                  <label htmlFor="title" className="form-label fw-semibold">
                    Nombre de la vacante <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Ej. Senior Frontend Developer"
                    required
                  />
                </div>

                <div className="row">
                  {/* 2. Empresa (elegir existente o escribir nueva) */}
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="companyName"
                      className="form-label fw-semibold"
                    >
                      Empresa <span className="text-danger">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="form-control"
                        id="companyName"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        onFocus={() => setShowEmpresas(true)}
                        onBlur={() =>
                          setTimeout(() => setShowEmpresas(false), 150)
                        }
                        placeholder="Escribe o elige una empresa..."
                        autoComplete="off"
                        required
                      />
                      {showEmpresas && empresasFiltradas.length > 0 && (
                        <ul
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 30,
                            margin: '2px 0 0',
                            padding: '4px 0',
                            listStyle: 'none',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            background: 'var(--bg-secondary, #ffffff)',
                            border: '1px solid var(--border-color, #d1d5db)',
                            borderRadius: '8px',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                          }}
                        >
                          {empresasFiltradas.map((c) => (
                            <li
                              key={c}
                              onMouseDown={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  companyName: c,
                                }));
                                setShowEmpresas(false);
                              }}
                              style={{
                                padding: '6px 12px',
                                cursor: 'pointer',
                                color: 'var(--text-primary, #111827)',
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  'rgba(124,58,237,0.10)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  'transparent')
                              }
                            >
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <small className="text-muted">
                      Elige una de la lista o escribe una nueva (no se
                      duplican).
                    </small>
                  </div>

                  {/* 3. Ubicación */}
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="location"
                      className="form-label fw-semibold"
                    >
                      Ubicación
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Ej. Madrid, España (o Remoto)"
                    />
                  </div>
                </div>

                <div className="row">
                  {/* 4. Sector (desplegable de familias) */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="sector" className="form-label fw-semibold">
                      Sector
                    </label>
                    <select
                      className="form-select"
                      id="sector"
                      name="sector"
                      value={formData.sector}
                      onChange={handleChange}
                    >
                      <option value="">Selecciona un sector...</option>
                      {LISTA_SECTORES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5. Fuente de origen */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="source" className="form-label fw-semibold">
                      Fuente de origen
                    </label>
                    <select
                      className="form-select"
                      id="source"
                      name="source"
                      value={formData.source}
                      onChange={handleChange}
                    >
                      <option value="">Selecciona el origen...</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="InfoJobs">InfoJobs</option>
                      <option value="Adzuna">Adzuna</option>
                      <option value="Búsqueda Directa">Búsqueda Directa</option>
                      <option value="Carga Manual">Carga Manual Interna</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                <div className="row">
                  {/* 6. Rango Salarial */}
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="salaryRange"
                      className="form-label fw-semibold"
                    >
                      Rango Salarial
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="salaryRange"
                      name="salaryRange"
                      value={formData.salaryRange}
                      onChange={handleChange}
                      placeholder="Ej. 35.000€ - 45.000€"
                    />
                  </div>

                  {/* 7. Hace cuánto ha sido publicada */}
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="publishedAgo"
                      className="form-label fw-semibold"
                    >
                      Publicada hace... <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      id="publishedAgo"
                      name="publishedAgo"
                      value={formData.publishedAgo}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Selecciona un tiempo...</option>
                      <option value="Hoy">Hoy</option>
                      <option value="Ayer">Ayer</option>
                      <option value="Esta semana">Esta semana</option>
                      <option value="Hace 1-2 semanas">Hace 1-2 semanas</option>
                      <option value="Hace +1 mes">Hace más de un mes</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    saving ||
                    !formData.title.trim() ||
                    !formData.companyName.trim() ||
                    !formData.publishedAgo
                  }
                >
                  {saving ? 'Guardando...' : 'Guardar Vacante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
