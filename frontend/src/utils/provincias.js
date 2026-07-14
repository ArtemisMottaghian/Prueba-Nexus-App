import { MUNI_PROV, PROV_NOMBRE } from './municipioProvincia';

const norm = (s) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const PROV_NORM = {};
for (const code in PROV_NOMBRE)
  PROV_NORM[norm(PROV_NOMBRE[code])] = PROV_NOMBRE[code];

const PROV_ALIAS = {
  'la coruna': 'A Coruña',
  coruna: 'A Coruña',
  gerona: 'Girona',
  guipuzcoa: 'Gipuzkoa',
  lerida: 'Lleida',
  orense: 'Ourense',
  vizcaya: 'Bizkaia',
  araba: 'Álava',
  'islas baleares': 'Baleares',
  'illes balears': 'Baleares',
  mallorca: 'Baleares',
  menorca: 'Baleares',
  ibiza: 'Baleares',
  tenerife: 'Santa Cruz de Tenerife',
  'gran canaria': 'Las Palmas',
};

export const provinciaDe = (loc) => {
  const limpio = norm(loc).replace(/\d{4,5}/g, ' ');
  const partes = [limpio, ...limpio.split(/[,/|·]/)]
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of partes) {
    if (MUNI_PROV[p]) return PROV_NOMBRE[MUNI_PROV[p]];
    if (PROV_NORM[p]) return PROV_NORM[p];
    if (PROV_ALIAS[p]) return PROV_ALIAS[p];
  }
  return null;
};
