import { supabase } from './cliente.js';

export const GRAVEDAD = {
  infraccion: { texto: 'posible infracción', color: '#9E1B32', fondo: '#FBE9EC', orden: 0 },
  incumplimiento: { texto: 'incumplimiento', color: '#8A6D1F', fondo: '#F6EFDC', orden: 1 },
  contable: { texto: 'contabilidad', color: '#5A6068', fondo: '#ECEBE4', orden: 2 }
};

export const OPINION = {
  favorable: { texto: 'sin salvedades', color: '#2E7D5B', fondo: '#E6F2EB' },
  con_salvedades: { texto: 'con salvedades', color: '#8A6D1F', fondo: '#F6EFDC' },
  desfavorable: { texto: 'desfavorable', color: '#9E1B32', fondo: '#FBE9EC' },
  denegada: { texto: 'sin opinión', color: '#9E1B32', fondo: '#FBE9EC' }
};

function numero(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function texto(v) {
  const t = String(v ?? '').trim();
  return t || null;
}

function nuevaFormacion(nombre) {
  return {
    nombre,
    reparos: [],
    opinion: null,
    extraido: false,
    cuenta: { infraccion: 0, incumplimiento: 0, contable: 0 }
  };
}

function nuevoPartido() {
  return { formaciones: new Map(), fuente: null };
}

function formacionDe(p, nombre) {
  const clave = nombre ?? '';
  if (!p.formaciones.has(clave)) p.formaciones.set(clave, nuevaFormacion(nombre));
  return p.formaciones.get(clave);
}

export function resumirFiscalizacion(reparos, opiniones) {
  const ejercicios = [...reparos, ...opiniones].map(f => Number(f.ejercicio)).filter(Number.isFinite);
  const ejercicio = ejercicios.length ? Math.max(...ejercicios) : null;
  if (!ejercicio) return { ejercicio: null, porPartido: {} };

  const partidos = {};

  for (const r of reparos) {
    if (!r.partido || Number(r.ejercicio) !== ejercicio || !texto(r.resumen)) continue;
    const p = (partidos[r.partido] ??= nuevoPartido());
    const f = formacionDe(p, texto(r.formacion));
    const gravedad = GRAVEDAD[r.gravedad] ? r.gravedad : 'contable';
    f.reparos.push({
      clave: r.apartado ?? `${r.pagina}-${f.reparos.length}`,
      gravedad,
      resumen: texto(r.resumen),
      importe: numero(r.importe),
      pagina: numero(r.pagina),
      nota: texto(r.nota),
      notaUrl: texto(r.nota_url)
    });
    f.cuenta[gravedad] += 1;
    if (r.confianza === 'comprobado') f.extraido = true;
    if (!p.fuente && r.fuente_url) p.fuente = { url: r.fuente_url, titulo: r.fuente ?? null };
  }

  for (const o of opiniones) {
    if (!o.partido || Number(o.ejercicio) !== ejercicio || !OPINION[o.opinion]) continue;
    const p = (partidos[o.partido] ??= nuevoPartido());
    const f = formacionDe(p, texto(o.formacion));
    f.opinion = {
      opinion: o.opinion,
      salvedades: numero(o.salvedades) ?? 0,
      limitacion: o.limitacion_alcance === true,
      pagina: numero(o.pagina),
      nota: texto(o.nota),
      notaUrl: texto(o.nota_url)
    };
    if (!p.fuente && o.fuente_url) p.fuente = { url: o.fuente_url, titulo: o.fuente ?? null };
  }

  const porPartido = {};
  for (const [slug, p] of Object.entries(partidos)) {
    const formaciones = [...p.formaciones.values()];
    for (const f of formaciones) {
      f.reparos.sort((a, b) =>
        GRAVEDAD[a.gravedad].orden - GRAVEDAD[b.gravedad].orden ||
        (b.importe ?? -1) - (a.importe ?? -1) ||
        (a.pagina ?? 0) - (b.pagina ?? 0)
      );
    }
    formaciones.sort((a, b) => {
      if (a.nombre === null) return -1;
      if (b.nombre === null) return 1;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
    porPartido[slug] = { formaciones, fuente: p.fuente };
  }

  return { ejercicio, porPartido };
}

export async function traerFiscalizacion() {
  if (!supabase) return null;

  const [reparos, opiniones] = await Promise.all([
    supabase.from('v_hallazgos_fiscalizacion').select('*'),
    supabase.from('v_opiniones_fiscalizacion').select('*')
  ]);

  if (reparos.error) {
    console.error('fiscalizacion', reparos.error.message);
    return null;
  }
  if (opiniones.error) console.error('opiniones del Tribunal', opiniones.error.message);

  return resumirFiscalizacion(reparos.data ?? [], opiniones.error ? [] : opiniones.data ?? []);
}