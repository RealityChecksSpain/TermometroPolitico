const CLAVE_PERFIL = 'lentedemocratica.perfil.v1';
const CLAVE_VISTO = 'lentedemocratica.visto.v1';
const ANTIGUAS_PERFIL = ['escano.perfil.v1'];
const ANTIGUAS_VISTO = ['escano.visto.v1'];

function migrar(clave, antiguas) {
  for (const vieja of antiguas) {
    try {
      const raw = localStorage.getItem(vieja);
      if (raw === null) continue;
      localStorage.setItem(clave, raw);
      localStorage.removeItem(vieja);
      return raw;
    } catch {
      try { localStorage.removeItem(vieja); } catch { continue; }
    }
  }
  return null;
}

export function cargarPerfilGuardado() {
  try {
    const raw = localStorage.getItem(CLAVE_PERFIL) ?? migrar(CLAVE_PERFIL, ANTIGUAS_PERFIL);
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
  } catch {}
}

export function borrarPerfilGuardado() {
  try {
    localStorage.removeItem(CLAVE_PERFIL);
    for (const vieja of ANTIGUAS_PERFIL) localStorage.removeItem(vieja);
  } catch {}
}

export function marcarVistoAhora() {
  try {
    localStorage.setItem(CLAVE_VISTO, new Date().toISOString().slice(0, 10));
  } catch {}
}

export function ultimaVista() {
  try {
    return localStorage.getItem(CLAVE_VISTO) ?? migrar(CLAVE_VISTO, ANTIGUAS_VISTO);
  } catch {
    return null;
  }
}

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