const CLAVE = 'lentenegra.seguimientos.v1';
const TIPOS = ['iniciativa', 'materia', 'politico'];

function vacio() {
  return { iniciativa: [], materia: [], politico: [] };
}

export function leerSeguimientos() {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return vacio();
    const datos = JSON.parse(raw);
    const salida = vacio();
    TIPOS.forEach(t => {
      salida[t] = Array.isArray(datos?.[t]) ? datos[t].filter(x => typeof x === 'string') : [];
    });
    return salida;
  } catch {
    return vacio();
  }
}

function escribir(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

export function estaSeguido(tipo, id) {
  return leerSeguimientos()[tipo]?.includes(id) ?? false;
}

export function alternarSeguimiento(tipo, id) {
  if (!TIPOS.includes(tipo)) throw new Error(`tipo de seguimiento desconocido: ${tipo}`);
  const datos = leerSeguimientos();
  const dentro = datos[tipo].includes(id);
  datos[tipo] = dentro ? datos[tipo].filter(x => x !== id) : [...datos[tipo], id];
  const ok = escribir(datos);
  return { ok, seguido: ok ? !dentro : dentro };
}

export function totalSeguimientos(datos) {
  const d = datos ?? leerSeguimientos();
  return TIPOS.reduce((a, t) => a + d[t].length, 0);
}