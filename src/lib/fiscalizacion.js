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

function nuevo() {
  return {
    reparos: [],
    opinion: null,
    fuente: null,
    extraido: false,
    cuenta: { infraccion: 0, incumplimiento: 0, contable: 0 }
  };
}

export function resumirFiscalizacion(reparos, opiniones) {
  const ejercicios = [...reparos, ...opiniones].map(f => Number(f.ejercicio)).filter(Number.isFinite);
  const ejercicio = ejercicios.length ? Math.max(...ejercicios) : null;
  if (!ejercicio) return { ejercicio: null, porPartido: {} };

  const porPartido = {};

  for (const r of reparos) {
    if (!r.partido || Number(r.ejercicio) !== ejercicio || !String(r.resumen ?? '').trim()) continue;
    const p = (porPartido[r.partido] ??= nuevo());
    const gravedad = GRAVEDAD[r.gravedad] ? r.gravedad : 'contable';
    p.reparos.push({
      clave: r.apartado ?? `${r.pagina}-${p.reparos.length}`,
      gravedad,
      resumen: String(r.resumen).trim(),
      importe: numero(r.importe),
      pagina: numero(r.pagina),
      nota: r.nota ? String(r.nota).trim() : null,
      notaUrl: r.nota_url ?? null
    });
    p.cuenta[gravedad] += 1;
    if (r.confianza === 'comprobado') p.extraido = true;
    if (!p.fuente && r.fuente_url) p.fuente = { url: r.fuente_url, titulo: r.fuente ?? null };
  }

  for (const o of opiniones) {
    if (!o.partido || Number(o.ejercicio) !== ejercicio || !OPINION[o.opinion]) continue;
    const p = (porPartido[o.partido] ??= nuevo());
    p.opinion = {
      opinion: o.opinion,
      salvedades: numero(o.salvedades) ?? 0,
      limitacion: o.limitacion_alcance === true,
      pagina: numero(o.pagina)
    };
    if (!p.fuente && o.fuente_url) p.fuente = { url: o.fuente_url, titulo: o.fuente ?? null };
  }

  for (const p of Object.values(porPartido)) {
    p.reparos.sort((a, b) =>
      GRAVEDAD[a.gravedad].orden - GRAVEDAD[b.gravedad].orden ||
      (b.importe ?? -1) - (a.importe ?? -1) ||
      (a.pagina ?? 0) - (b.pagina ?? 0)
    );
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
