import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const clave = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export function diagnosticarConfig() {
  const fallos = [];

  if (!url) {
    fallos.push('VITE_SUPABASE_URL esta vacia.');
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    fallos.push(
      url.startsWith('sb_') || url.startsWith('eyJ')
        ? 'VITE_SUPABASE_URL contiene una CLAVE, no una URL. Debe ser https://xxxx.supabase.co'
        : `VITE_SUPABASE_URL no tiene formato valido: "${url.slice(0, 40)}". Sin /rest/v1 al final.`
    );
  }

  if (!clave) {
    fallos.push('VITE_SUPABASE_ANON_KEY esta vacia.');
  } else if (clave.startsWith('http')) {
    fallos.push('VITE_SUPABASE_ANON_KEY contiene una URL, no una clave. Estan intercambiadas.');
  } else if (!clave.startsWith('sb_publishable_') && !clave.startsWith('eyJ')) {
    fallos.push('VITE_SUPABASE_ANON_KEY no parece una clave de Supabase.');
  } else if (clave.startsWith('sb_secret_') || clave.includes('service_role')) {
    fallos.push('PELIGRO: has puesto la clave SECRETA en el frontend. Usa la publicable.');
  }

  return fallos;
}

export const problemasConfig = diagnosticarConfig();
export const faltaConfig = problemasConfig.length > 0;

export const supabase = faltaConfig
  ? null
  : createClient(url.replace(/\/$/, ''), clave, { auth: { persistSession: false } });

export async function traerDiputados() {
  const { data, error } = await supabase
    .from('mv_diputados')
    .select('*')
    .order('eje1', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function traerVotaciones(limite = 200, filtros = {}) {
  let q = supabase.from('mv_votaciones').select('*');
  if (filtros.id) q = q.eq('id', filtros.id);
  if (filtros.materia) q = q.eq('materia', filtros.materia);
  if (filtros.colectivo) q = q.contains('colectivos', [filtros.colectivo]);
  if (filtros.texto?.trim()) {
    q = q.or(`titulo.ilike.%${filtros.texto}%,subtitulo.ilike.%${filtros.texto}%,resumen.ilike.%${filtros.texto}%`);
  }
  const { data, error } = await q.order('fecha', { ascending: false }).limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function traerFacetas() {
  const [m, c] = await Promise.all([
    supabase.from('mv_facetas_materia').select('*').order('orden').order('votaciones', { ascending: false }),
    supabase.from('mv_facetas_colectivo').select('*').order('orden').order('votaciones', { ascending: false })
  ]);
  return { materias: m.data ?? [], colectivos: c.data ?? [] };
}

export async function buscarVotaciones(texto, limite = 60) {
  const { data, error } = await supabase
    .from('mv_votaciones')
    .select('*')
    .or(`titulo.ilike.%${texto}%,subtitulo.ilike.%${texto}%`)
    .order('fecha', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function traerVotos(votacionId) {
  const salida = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('votos')
      .select('mandato_id, voto, telematico')
      .eq('votacion_id', votacionId)
      .range(desde, desde + 999);
    if (error) throw error;
    if (!data?.length) break;
    salida.push(...data);
    if (data.length < 1000) break;
    desde += 1000;
  }
  return salida;
}

export async function traerEjes() {
  const { data, error } = await supabase
    .from('ejes_calculados')
    .select('*')
    .order('numero');
  if (error) throw error;
  return data ?? [];
}

export async function traerCobertura() {
  const { data, error } = await supabase.from('mv_cobertura').select('*').limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function traerVotosDeDiputado(mandatoId, limite = 60, desde = 0) {
  const { data, error } = await supabase.rpc('votos_de_diputado', {
    p_mandato_id: mandatoId, p_limite: limite, p_desde: desde
  });
  if (error) throw error;
  return data ?? [];
}

export async function traerResumenDiputado(mandatoId) {
  const { data, error } = await supabase.rpc('resumen_diputado', { p_mandato_id: mandatoId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function traerCircunscripciones() {
  const { data, error } = await supabase
    .from('mv_circunscripciones').select('*').order('circunscripcion');
  if (error) throw error;
  return data ?? [];
}

export async function traerCcaa() {
  const { data, error } = await supabase.from('mv_ccaa').select('*').order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function traerProgramas() {
  const { data, error } = await supabase.from('v_programas').select('*').order('promesas', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function traerPromesas(partido, soloVerificables = false, limite = 200) {
  let q = supabase.from('v_promesas').select('*').eq('partido', partido);
  if (soloVerificables) q = q.eq('verificable', true);
  const { data, error } = await q.order('orden').limit(limite);
  if (error) throw error;
  return data ?? [];
}