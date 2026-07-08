import { useState, useRef, useEffect, useMemo } from 'react';
import { UBICACIONES_POR_PROVINCIA } from '../../../utils/ubicacionesEspana';
import './LocationSelect.css';

const norm = (s) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function LocationSelect({
  value,
  onChange,
  locationOptions = [],
  counts,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);

  const selected = value && value !== 'All' ? value : '';

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const conocidas = useMemo(() => {
    const s = new Set();
    UBICACIONES_POR_PROVINCIA.forEach((p) => {
      s.add(norm(p.provincia));
      p.ciudades.forEach((c) => s.add(norm(c)));
    });
    return s;
  }, []);

  const extras = useMemo(() => {
    const strings = (locationOptions || [])
      .map((o) => (typeof o === 'object' ? o?.value : o))
      .filter(Boolean)
      .map(String);
    return [...new Set(strings)]
      .filter((u) => !conocidas.has(norm(u)))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [locationOptions, conocidas]);

  const q = norm(query);

  const grupos = useMemo(() => {
    if (!q) return UBICACIONES_POR_PROVINCIA;
    return UBICACIONES_POR_PROVINCIA.map((p) => {
      const provMatch = norm(p.provincia).includes(q);
      const ciudades = provMatch
        ? p.ciudades
        : p.ciudades.filter((c) => norm(c).includes(q));
      return ciudades.length ? { provincia: p.provincia, ciudades } : null;
    }).filter(Boolean);
  }, [q]);

  const extrasFiltradas = useMemo(
    () => (q ? extras.filter((o) => norm(o).includes(q)) : extras),
    [q, extras]
  );

  const pick = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const cityCount = (name) => counts?.ciudades?.[name] || 0;
  const provCount = (name) => counts?.provincias?.[name] || 0;

  const sinResultados = grupos.length === 0 && extrasFiltradas.length === 0;

  return (
    <div className="loc-select" ref={boxRef}>
      <button
        type="button"
        className={`pill-select loc-select__trigger ${selected ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={selected || 'Ubicación: todas'}
      >
        <span className="loc-select__value">
          {selected || 'Ubicación: todas'}
        </span>
        <i className="bi bi-chevron-down loc-select__caret"></i>
      </button>

      {open && (
        <div className="loc-select__panel">
          <input
            autoFocus
            className="loc-select__search"
            placeholder="Buscar provincia o ciudad..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="loc-select__list">
            <button
              type="button"
              className="loc-select__item loc-select__item--all"
              onClick={() => pick('All')}
            >
              Todas las ubicaciones
            </button>

            {extrasFiltradas.length > 0 && (
              <div className="loc-select__group">
                <div className="loc-select__prov">En tus datos</div>
                {extrasFiltradas.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className="loc-select__item loc-select__city"
                    onClick={() => pick(o)}
                  >
                    <span className="loc-select__name">{o}</span>
                    {cityCount(o) > 0 && (
                      <span className="loc-select__count">{cityCount(o)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {grupos.map((p) => (
              <div key={p.provincia} className="loc-select__group">
                <div className="loc-select__prov">
                  <span>{p.provincia}</span>
                  {provCount(p.provincia) > 0 && (
                    <span className="loc-select__count loc-select__count--prov">
                      {provCount(p.provincia)}
                    </span>
                  )}
                </div>
                {p.ciudades.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="loc-select__item loc-select__city"
                    onClick={() => pick(c)}
                  >
                    <span className="loc-select__name">{c}</span>
                    {cityCount(c) > 0 && (
                      <span className="loc-select__count">{cityCount(c)}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}

            {sinResultados && (
              <div className="loc-select__empty">Sin resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
