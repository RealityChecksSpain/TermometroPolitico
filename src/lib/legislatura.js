export const DISOLUCION = '2026-10-06';
export const ELECCIONES = '2026-11-29';
export const CONSTITUCION = '2026-12-23';
export const BOE_DISOLUCION = 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20742';

function dia(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(valor).slice(0, 10);
}

export function esDiputacionPermanente(fecha) {
  const f = dia(fecha);
  return Boolean(f) && f > DISOLUCION && f < CONSTITUCION;
}

export function cortesDisueltas(hoy = new Date()) {
  const f = dia(hoy);
  return f >= DISOLUCION && f < CONSTITUCION;
}
