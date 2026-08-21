/** Limpia y acorta titulares/resúmenes para listados (sin jerga de plantilla). */

const PREFIJOS = /^\s*(?:la\s+norma\s+)?(?:regula|establece|aprueba|modifica|tramita|crea|introduce|amplía|amplia|preve|prevé|dispone|fija|actualiza|refuerza|permite|prohibe|prohíbe|deroga|supone|define|ordena)\s+(?:que\s+)?/i;

const RELLENO = /^\s*(?:se\s+)?(?:regula|establece|aprueba|modifica)\s+/i;

export function limpiarFrase(texto, max = 52) {
  if (!texto) return null;
  let t = String(texto).trim();

  // Si viene un párrafo, quédate con la primera frase.
  t = t.split(/(?<=\.)\s+/)[0].replace(/\.$/, '').trim();

  t = t.replace(PREFIJOS, '').replace(RELLENO, '').trim();
  // Capitaliza tras quitar el prefijo.
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);

  // Recorta por palabra cerca del límite.
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const i = corte.lastIndexOf(' ');
  const base = (i > 20 ? corte.slice(0, i) : corte).trim();
  return base.replace(/[,;:.\-–—]+$/, '') + '…';
}

export function fraseCortaDeNorma(n, max = 52) {
  const fuente = n?.frase_corta || n?.en_una_frase || n?.titular_corto || n?.resumen;
  return limpiarFrase(fuente, max);
}
