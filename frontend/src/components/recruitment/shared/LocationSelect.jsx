import { useState, useRef, useEffect, useMemo } from 'react';
import { MUNI_PROV, PROV_NOMBRE } from '../../../utils/municipioProvincia';
import './LocationSelect.css';

const norm = (s) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const provinciaDe = (loc) => PROV_NOMBRE[MUNI_PROV[norm(loc)]] || null;

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

  const { grupos, otras } = useMemo(() => {
    const strings = [
      ...new Set(
        (locationOptions || [])
          .map((o) => (typeof o === 'object' ? o?.value : o))
          .filter(Boolean)
          .map(String)
      ),
    ];
    const byProv = {};
    const sinProv = [];
    strings.forEach((loc) => {
      const prov = provinciaDe(loc);
      if (prov) (byProv[prov] = byProv[prov] || []).push(loc);
      else sinProv.push(loc);
    });
    const grupos = Object.keys(byProv)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((prov) => ({
        provincia: prov,
        ciudades: byProv[prov].sort((a, b) => a.localeCompare(b, 'es')),
      }));
    return { grupos, otras: sinProv.sort((a, b) => a.localeCompare(b, 'es')) };
  }, [locationOptions]);

  const q = norm(query);

  const gruposFiltrados = useMemo(() => {
    if (!q) return grupos;
    return grupos
      .map((p) => {
        const provMatch = norm(p.provincia).includes(q);
        const ciudades = provMatch
          ? p.ciudades
          : p.ciudades.filter((c) => norm(c).includes(q));
        return ciudades.length ? { provincia: p.provincia, ciudades } : null;
      })
      .filter(Boolean);
  }, [q, grupos]);

  const otrasFiltradas = useMemo(
    () => (q ? otras.filter((o) => norm(o).includes(q)) : otras),
    [q, otras]
  );

  const pick = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const cityCount = (name) => counts?.ciudades?.[name] || 0;
  const provTotal = (ciudades) =>
    ciudades.reduce((n, c) => n + cityCount(c), 0);

  const sinResultados =
    gruposFiltrados.length === 0 && otrasFiltradas.length === 0;

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

            {gruposFiltrados.map((p) => (
              <div key={p.provincia} className="loc-select__group">
                <div className="loc-select__prov">
                  <span>{p.provincia}</span>
                  {provTotal(p.ciudades) > 0 && (
                    <span className="loc-select__count loc-select__count--prov">
                      {provTotal(p.ciudades)}
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

            {otrasFiltradas.length > 0 && (
              <div className="loc-select__group">
                <div className="loc-select__prov">Otras ubicaciones</div>
                {otrasFiltradas.map((o) => (
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

            {sinResultados && (
              <div className="loc-select__empty">Sin resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
