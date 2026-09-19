const VACIOS = /^\s*(?:la\s+(?:norma|ley|proposici[oó]n)\s+)?(?:se\s+)?(?:regula|establece|aprueba)\s+(?:que\s+)?/i;

export function limpiarFrase(texto, max = 48) {
  if (!texto) return null;
  let t = String(texto).trim();

  t = t.split(/(?<=\.)\s+/)[0].replace(/\.$/, '').trim();
  t = t.replace(VACIOS, '').trim();
  if (!t) return null;
  t = t.charAt(0).toUpperCase() + t.slice(1);

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

export function nombreOficialNorma(n) {
  const raw = n?.titular || n?.subtitulo || n?.titulo || '';
  return String(raw)
    .replace(/^\s*proposición\s+de\s+ley\s+presentada\s+por\s+el\s+grupo\s+parlamentario\s+de\s+\S+\s*[:.\-–—]?\s*/i, '')
    .replace(/^\s*presentada\s+por\s+el\s+grupo\s+parlamentario\s+(de\s+)?[^.:\-–—]+[:.\-–—]\s*/i, '')
    .trim() || String(raw);
}