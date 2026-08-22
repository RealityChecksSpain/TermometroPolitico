/** Limpia y acorta titulares/resúmenes para listados (sin jerga ni artículos iniciales). */

const PREFIJOS = /^\s*(?:la\s+norma\s+)?(?:regula|establece|aprueba|modifica|tramita|crea|introduce|amplía|amplia|preve|prevé|dispone|fija|actualiza|refuerza|permite|prohibe|prohíbe|deroga|supone|define|ordena)\s+(?:que\s+)?/i;

const RELLENO = /^\s*(?:se\s+)?(?:regula|establece|aprueba|modifica)\s+/i;

const ARTICULO = /^(?:el|la|los|las|un|una|unos|unas)\s+/i;

/** Convierte fragmentos descriptivos en titular corto. */
function titularizar(t) {
  let s = t.trim();

  // "situación de X" → "Situación de X" (ya sin artículo)
  // Preferir arranques de tipo reforma / nueva / modificación si el texto lo sugiere
  if (/^modificaci[oó]n\s+(?:del?\s+|de\s+la\s+|al?\s+)/i.test(s)) {
    s = s.replace(/^modificaci[oó]n\s+(?:del?\s+|de\s+la\s+|al?\s+)/i, 'Modificación de ');
  } else if (/^situaci[oó]n\s+de\s+/i.test(s)) {
    s = s.replace(/^situaci[oó]n\s+de\s+/i, 'Reforma de ');
  } else if (/^evaluaci[oó]n\s+/i.test(s)) {
    s = 'Nueva ' + s.charAt(0).toLowerCase() + s.slice(1);
  } else if (/^plan\s+/i.test(s)) {
    s = s; // Plan… ya suena a titular
  } else if (/^estado\s+asume/i.test(s)) {
    s = s.replace(/^estado\s+/i, 'Estado ');
  }

  // Quitar artículos residuales al inicio
  s = s.replace(ARTICULO, '').trim();
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

export function limpiarFrase(texto, max = 48) {
  if (!texto) return null;
  let t = String(texto).trim();

  // Si viene un párrafo, quédate con la primera frase.
  t = t.split(/(?<=\.)\s+/)[0].replace(/\.$/, '').trim();

  t = t.replace(PREFIJOS, '').replace(RELLENO, '').trim();
  t = titularizar(t);

  // Recorta por palabra cerca del límite.
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const i = corte.lastIndexOf(' ');
  const base = (i > 18 ? corte.slice(0, i) : corte).trim();
  return base.replace(/[,;:.\-–—]+$/, '') + '…';
}

export function fraseCortaDeNorma(n, max = 48) {
  const fuente = n?.frase_corta || n?.en_una_frase || n?.titular_corto || n?.resumen;
  return limpiarFrase(fuente, max);
}

/** Nombre oficial de la norma, limpio de muletillas de presentación. */
export function nombreOficialNorma(n) {
  const raw = n?.titular || n?.subtitulo || n?.titulo || '';
  return String(raw)
    .replace(/^\s*proposición\s+de\s+ley\s+presentada\s+por\s+el\s+grupo\s+parlamentario\s+de\s+\S+\s*[:.\-–—]?\s*/i, '')
    .replace(/^\s*presentada\s+por\s+el\s+grupo\s+parlamentario\s+(de\s+)?[^.:\-–—]+[:.\-–—]\s*/i, '')
    .trim() || String(raw);
}
