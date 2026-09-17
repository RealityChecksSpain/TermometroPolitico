import { supabase } from './cliente.js';

export const ESTADOS = {
  publicado: { texto: 'publicado', color: '#2E7D5B', fondo: '#E6F2EB' },
  parcial: { texto: 'parcial', color: '#8A6D1F', fondo: '#F6EFDC' },
  ausente: { texto: 'no publicado', color: '#9E1B32', fondo: '#FBE9EC' },
  no_verificable: { texto: 'no verificable', color: '#7C8288', fondo: '#F1F1EC' },
  sin_comprobar: { texto: 'sin comprobar', color: '#8E9299', fondo: '#F1F1EC' }
};

export async function traerTransparencia() {
  if (!supabase) return null;

  const [obl, res, det, par] = await Promise.all([
    supabase.from('transparencia_obligacion').select('*'),
    supabase.from('v_transparencia_resumen').select('*'),
    supabase.from('v_transparencia').select('*'),
    supabase.from('partidos').select('*')
  ]);

  const fallos = [
    obl.error && `transparencia_obligacion: ${obl.error.message}`,
    res.error && `v_transparencia_resumen: ${res.error.message}`,
    det.error && `v_transparencia: ${det.error.message}`,
    par.error && `partidos: ${par.error.message}`
  ].filter(Boolean);

  if (fallos.length) {
    console.error('transparencia', fallos.join(' | '));
    return null;
  }

  if (!obl.data?.length) return null;

  const catalogo = obl.data
    .filter(o => o.sujeto === 'partido')
    .sort((a, b) => Number(a.orden) - Number(b.orden));

  if (!catalogo.length) return null;

  const resumen = {};
  for (const f of res.data ?? []) {
    if (!f.partido) continue;
    const previo = resumen[f.partido];
    if (previo && Number(previo.ejercicio) >= Number(f.ejercicio)) continue;
    resumen[f.partido] = {
      ejercicio: Number(f.ejercicio),
      enLaLey: Number(f.obligaciones_en_la_ley ?? catalogo.length),
      comprobadas: Number(f.comprobadas ?? 0),
      publicadas: Number(f.publicadas ?? 0),
      parciales: Number(f.parciales ?? 0),
      ausentes: Number(f.ausentes ?? 0),
      noVerificables: Number(f.no_verificables ?? 0),
      ultimaConsulta: f.ultima_consulta ?? null
    };
  }

  const detalle = {};
  for (const f of det.data ?? []) {
    if (f.tipo_sujeto !== 'partido' || !f.sujeto_clave) continue;
    const ej = resumen[f.sujeto_clave]?.ejercicio;
    if (ej != null && Number(f.ejercicio) !== ej) continue;
    (detalle[f.sujeto_clave] ??= {})[f.obligacion] = {
      estado: f.estado,
      url: f.url ?? null,
      nota: f.nota ?? null,
      fecha: f.fecha_consulta ?? null
    };
  }

  const webs = {};
  for (const p of par.data ?? []) {
    if (p.slug) webs[p.slug] = p.web ?? null;
  }

  return { catalogo, resumen, detalle, webs };
}