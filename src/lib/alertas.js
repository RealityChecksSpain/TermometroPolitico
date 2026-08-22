const CLAVE_PERFIL = 'escano.perfil.v1';
const CLAVE_VISTO = 'escano.visto.v1';

export function cargarPerfilGuardado() {
  try {
    const raw = localStorage.getItem(CLAVE_PERFIL);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function guardarPerfil(perfil) {
  try {
    localStorage.setItem(CLAVE_PERFIL, JSON.stringify({
      ...perfil,
      guardadoEn: new Date().toISOString()
    }));
  } catch { /* ignore */ }
}

export function borrarPerfilGuardado() {
  try { localStorage.removeItem(CLAVE_PERFIL); } catch { /* ignore */ }
}

export function marcarVistoAhora() {
  try {
    localStorage.setItem(CLAVE_VISTO, new Date().toISOString().slice(0, 10));
  } catch { /* ignore */ }
}

export function ultimaVista() {
  try {
    return localStorage.getItem(CLAVE_VISTO);
  } catch {
    return null;
  }
}

/** Normas más recientes que la última visita y que coinciden con el perfil. */
export function filtrarNovedades(normas, perfil, desde) {
  if (!perfil || !normas?.length) return [];
  const cols = new Set(perfil.colectivos ?? []);
  const mats = new Set(perfil.materias ?? []);
  return normas.filter(n => {
    if (desde && n.fecha && n.fecha <= desde) return false;
    const efectos = Array.isArray(n.efectos) ? n.efectos : [];
    const hitCol = efectos.some(e => cols.has(e.slug))
      || (Array.isArray(n.colectivos) && n.colectivos.some(c => cols.has(c)));
    const hitMat = n.materia && mats.has(n.materia);
    return hitCol || hitMat;
  });
}
