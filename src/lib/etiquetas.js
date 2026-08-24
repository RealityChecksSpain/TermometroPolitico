import { implicacionDe } from './implicaciones.js';

export function nombreColectivo(slug, lista) {
  if (!slug) return '';
  const tip = implicacionDe(slug);
  if (tip?.etiqueta) return tip.etiqueta;
  const enFacetas = (lista ?? []).find(c => c.slug === slug)?.nombre;
  if (enFacetas) return enFacetas;
  const s = String(slug).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function etiquetasDeNorma(n, lista) {
  const efectos = Array.isArray(n?.efectos) ? n.efectos : [];
  if (efectos.length) {
    return efectos.map(e => e?.nombre || nombreColectivo(e?.slug, lista)).filter(Boolean);
  }
  const colectivos = Array.isArray(n?.colectivos) ? n.colectivos : [];
  return colectivos
    .map(c => (typeof c === 'string' ? nombreColectivo(c, lista) : (c?.nombre || nombreColectivo(c?.slug, lista))))
    .filter(Boolean);
}
