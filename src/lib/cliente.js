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
  let lista = data ?? [];

  // mv_diputados a veces se queda sin foto_url tras un refresh fallido;
  // las fotos viven en mandatos.
  const sinFoto = lista.filter(d => !d.foto_url).map(d => d.mandato_id).filter(Boolean);
  if (sinFoto.length) {
    const fotos = [];
    for (let i = 0; i < sinFoto.length; i += 200) {
      const chunk = sinFoto.slice(i, i + 200);
      const { data: filas } = await supabase
        .from('mandatos')
        .select('id, foto_url, cod_parlamentario, url_ficha, url_bienes')
        .in('id', chunk);
      if (filas?.length) fotos.push(...filas);
    }
    if (fotos.length) {
      const mapa = new Map(fotos.map(f => [f.id, f]));
      lista = lista.map(d => {
        const m = mapa.get(d.mandato_id);
        if (!m) return d;
        return {
          ...d,
          foto_url: d.foto_url || m.foto_url || (m.cod_parlamentario
            ? `https://www.congreso.es/docu/imgweb/diputados/${m.cod_parlamentario}_15.jpg`
            : null),
          cod_parlamentario: d.cod_parlamentario ?? m.cod_parlamentario,
          url_ficha: d.url_ficha || m.url_ficha,
          url_bienes: d.url_bienes || m.url_bienes
        };
      });
    }
  }

  // Patrimonio / inmuebles desde bienes_declarados (batch Gemini o revisión humana)
  const ids = lista.map(d => d.mandato_id).filter(Boolean);
  const bienes = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: filas } = await supabase
      .from('bienes_declarados')
      .select('mandato_id, patrimonio_euros, n_inmuebles, inmuebles_urbanos, inmuebles_rusticos, depositos, valores, planes_pensiones, deuda_pendiente')
      .in('mandato_id', chunk);
    if (filas?.length) bienes.push(...filas);
  }
  if (bienes.length) {
    const bm = new Map(bienes.map(b => [b.mandato_id, b]));
    lista = lista.map(d => {
      const b = bm.get(d.mandato_id);
      if (!b) return d;
      const casas = b.n_inmuebles ?? (
        (b.inmuebles_urbanos != null || b.inmuebles_rusticos != null)
          ? (Number(b.inmuebles_urbanos ?? 0) + Number(b.inmuebles_rusticos ?? 0))
          : null
      );
      let patrimonio = b.patrimonio_euros;
      if (patrimonio == null) {
        const act = [b.depositos, b.valores, b.planes_pensiones]
          .filter(v => v != null)
          .reduce((a, v) => a + Number(v), 0);
        if (act || b.deuda_pendiente != null) {
          patrimonio = act - Number(b.deuda_pendiente ?? 0);
        }
      }
      return {
        ...d,
        patrimonio_euros: d.patrimonio_euros ?? patrimonio,
        bienes_total: d.bienes_total ?? patrimonio,
        n_inmuebles: d.n_inmuebles ?? casas,
        n_casas: d.n_casas ?? casas
      };
    });
  }

  return lista;
}

export async function traerVotaciones(limite = 200, filtros = {}) {
  if (filtros.id) {
    const { data, error } = await supabase.from('mv_votaciones').select('*').eq('id', filtros.id);
    if (error) throw error;
    return data ?? [];
  }
  let q = supabase.from('mv_normas').select('*');
  if (filtros.materia) q = q.eq('materia', filtros.materia);
  if (filtros.colectivo) q = q.contains('colectivos', [filtros.colectivo]);
  if (filtros.texto?.trim()) {
    q = q.or(`titular.ilike.%${filtros.texto}%,resumen.ilike.%${filtros.texto}%`);
  }
  const { data, error } = await q.order('fecha', { ascending: false }).limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function traerVotacionesDeNorma(clave) {
  const { data, error } = await supabase.rpc('votaciones_de_norma', { p_clave: clave });
  if (error) return [];
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

export async function traerCoherencia() {
  const { data, error } = await supabase
    .from('mv_coherencia').select('*').order('pct_coherencia', { ascending: false, nullsFirst: false });
  if (error) return [];
  return data ?? [];
}

export async function traerDestacadas(limite = 5) {
  const { data, error } = await supabase
    .from('mv_destacadas').select('*').order('relevancia', { ascending: false }).limit(limite);
  if (error) return [];
  return data ?? [];
}

export async function traerLideres(metrica) {
  const { data, error } = await supabase
    .from('mv_lider_partido').select('*').eq('metrica', metrica).order('valor', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function traerMapaPartidos() {
  const { data, error } = await supabase.from('v_mapa_partidos').select('*');
  if (!error && data?.length) return data.map(normalizarFilaMapa);

  // Fallback: la vista puede no existir (PGRST205) aunque mv_eje_* sí tengan datos.
  const [{ data: prog }, { data: votos }, { data: dips }] = await Promise.all([
    supabase.from('mv_eje_programa').select('*'),
    supabase.from('mv_eje_votos').select('*'),
    supabase.from('mv_diputados').select('partido_siglas, partido, activo')
  ]);

  const escanos = new Map();
  for (const d of dips ?? []) {
    if (d.activo === false) continue;
    const k = d.partido_siglas || d.partido;
    if (!k) continue;
    escanos.set(k, (escanos.get(k) ?? 0) + 1);
  }

  const porSlug = new Map();
  for (const p of prog ?? []) {
    porSlug.set(p.partido, {
      partido: p.partido,
      siglas: p.siglas,
      color: p.color,
      prog_economico: p.eje_economico,
      prog_social: p.eje_social,
      prog_bruto_economico: p.bruto_economico,
      promesas_codificadas: p.promesas,
      voto_economico: null,
      voto_social: null,
      leyes_valoradas: null,
      escanos: escanos.get(p.siglas) ?? escanos.get(p.partido) ?? 0
    });
  }
  for (const v of votos ?? []) {
    const base = porSlug.get(v.partido) ?? {
      partido: v.partido,
      siglas: v.siglas,
      color: v.color,
      prog_economico: null,
      prog_social: null,
      promesas_codificadas: null,
      escanos: escanos.get(v.siglas) ?? 0
    };
    porSlug.set(v.partido, {
      ...base,
      color: base.color || v.color,
      voto_economico: v.eje_economico,
      voto_social: v.eje_social,
      leyes_valoradas: v.leyes_valoradas ?? v.leyes_apoyadas
    });
  }

  return Array.from(porSlug.values()).map(normalizarFilaMapa);
}

function normalizarFilaMapa(d) {
  return {
    ...d,
    prog_economico: d.prog_economico ?? d.eje_economico ?? null,
    prog_social: d.prog_social ?? d.eje_social ?? null,
    voto_economico: d.voto_economico ?? null,
    voto_social: d.voto_social ?? null,
    promesas_codificadas: d.promesas_codificadas ?? d.promesas ?? null,
    leyes_valoradas: d.leyes_valoradas ?? d.leyes_apoyadas ?? null,
    escanos: d.escanos ?? d.diputados ?? 1,
    color: d.color || d.color_hex || '#8E9299'
  };
}

export async function traerRelacionadas(norma, limite = 4) {
  if (!norma?.materia) return [];
  const { data, error } = await supabase
    .from('mv_normas').select('clave_norma, titular, fecha, materia_nombre, materia_color, total_si, total_no, resultado_final, resultado_ultima, votacion_principal')
    .eq('materia', norma.materia)
    .neq('clave_norma', norma.clave_norma ?? '')
    .order('fecha', { ascending: false })
    .limit(30);
  if (error) return [];
  return (data ?? [])
    .filter(n => (n.resultado_final ?? n.resultado_ultima) === 'aprobada')
    .slice(0, limite);
}

export async function traerActividades(mandatoId) {
  const { data, error } = await supabase.rpc('actividades_de_diputado', { p_mandato_id: mandatoId });
  if (error) return [];
  return data ?? [];
}

export async function traerSesgo() {
  const { data, error } = await supabase.from('v_sesgo_programas').select('*').limit(1);
  if (error) return null;
  return data?.[0] ?? null;
}

export async function traerFeed(limite = 20, desplazamiento = 0, filtros = {}) {
  let q = supabase.from('mv_normas').select('*');
  if (filtros.materia) q = q.eq('materia', filtros.materia);
  if (filtros.colectivo) q = q.contains('colectivos', [filtros.colectivo]);
  if (filtros.soloAprobadas) q = q.not('resumen', 'is', null);
  const { data, error } = await q
    .order('fecha', { ascending: false })
    .range(desplazamiento, desplazamiento + limite - 1);
  if (error) throw error;
  return data ?? [];
}

export async function traerPromesaVsVoto() {
  const { data, error } = await supabase.from('v_promesa_vs_voto').select('*').order('brecha_gasto');
  if (error) return [];
  return data ?? [];
}

export async function traerUltimas(limite = 6) {
  const campos = 'clave_norma, votacion_principal, titular, fecha, materia, materia_nombre, materia_color, resultado_final, resultado_ultima, total_si, total_no, resumen, frase_corta, colectivos, efectos';
  const { data, error } = await supabase
    .from('mv_normas').select(campos)
    .order('fecha', { ascending: false }).limit(limite);
  if (error) {
    // columnas opcionales pueden faltar en la vista
    const { data: d2, error: e2 } = await supabase
      .from('mv_normas').select('clave_norma, votacion_principal, titular, fecha, materia_nombre, materia_color, resultado_final, resultado_ultima, total_si, total_no, resumen, colectivos')
      .order('fecha', { ascending: false }).limit(limite);
    if (e2) {
      const { data: d3 } = await supabase
        .from('mv_normas').select('clave_norma, votacion_principal, titular, fecha, materia_nombre, materia_color, resultado_final, resultado_ultima, total_si, total_no, resumen')
        .order('fecha', { ascending: false }).limit(limite);
      return d3 ?? [];
    }
    return d2 ?? [];
  }
  return data ?? [];
}