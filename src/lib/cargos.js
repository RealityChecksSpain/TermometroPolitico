export function tieneCargo(d) {
  return String(d?.cargo ?? '').trim() !== '';
}

function enMinuscula(texto) {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export function causaAusencia(cargo) {
  const c = String(cargo ?? '').trim();
  if (!c) return null;
  if (/^presidente del gobierno/i.test(c)) {
    return 'presidente del Gobierno, con reuniones políticas y diplomáticas dentro y fuera de España';
  }
  if (/ministr/i.test(c)) return `${enMinuscula(c)}, con la agenda de su ministerio`;
  if (/congreso|mesa/i.test(c)) return `${enMinuscula(c)}, con funciones en la Mesa de la Cámara`;
  return enMinuscula(c);
}

export function avisoAusencia(d) {
  const causa = causaAusencia(d?.cargo);
  if (!causa) return null;
  const n = String(Math.round(Number(d?.ausencias ?? 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${d.nombre_completo}: ${n} ausencias. Causa posible: ${causa}.`;
}
