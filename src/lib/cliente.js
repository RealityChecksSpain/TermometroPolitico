import { createClient } from '@supabase/supabase-js';
import { clasificarVehiculos } from './vehiculos.js';
import { contarInmuebles } from './inmuebles.js';
import { sanearImporte, patrimonioLiquido } from './euros.js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const clave = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

const MINIMO_PROMESAS_BRECHA = 10;
const MINIMO_LEYES_BRECHA = 5;

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

  const sinFoto = lista.filter(d => !d.foto_url).map(d => d.mandato_id).filter(Boolean);
  if (sinFoto.length) {
    const fotos = [];
    for (let i = 0; i < sinFoto.length; i += 200) {
      const chunk = sinFoto.slice(i, i + 200);
      const { data: filas, error } = await supabase
        .from('mandatos')
        .select('id, foto_url, cod_parlamentario, url_ficha, url_bienes')
        .in('id', chunk);
      if (error) {
        console.error(`traerDiputados: no se pueden leer las fichas de mandato (${error.message}).`);
        break;
      }
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

  const ids = lista.map(d => d.mandato_id).filter(Boolean);
  const bienes = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: filas, error } = await supabase
      .from('bienes_declarados')
      .select('mandato_id, patrimonio_euros, n_inmuebles, n_inmuebles_propios, n_inmuebles_sociedad, n_inmuebles_equivalentes, n_viviendas, n_suelo, n_anejos, n_productivos, n_otros_bienes, inmuebles_urbanos, inmuebles_rusticos, inmuebles_detalle, inmuebles_detalle_propios, inmuebles_detalle_sociedad, depositos, valores, planes_pensiones, deuda_pendiente, vehiculos, vehiculos_detalle, n_coches, n_motos, n_embarcaciones, n_aeronaves, introducido_por, confianza')
      .in('mandato_id', chunk);
    if (error) {
      console.error(`traerDiputados: no se pueden leer los bienes declarados (${error.message}). Se muestran los diputados sin patrimonio.`);
      break;
    }
    if (filas?.length) bienes.push(...filas);
  }
  if (bienes.length) {
    const bm = new Map(bienes.map(b => [b.mandato_id, b]));
    lista = lista.map(d => {
      const b = bm.get(d.mandato_id);
      if (!b) return d;
      const inm = contarInmuebles(
        b.inmuebles_detalle,
        b.inmuebles_urbanos,
        b.inmuebles_rusticos,
        b.inmuebles_detalle_propios,
        b.inmuebles_detalle_sociedad
      );

      const propios = inm.n_inmuebles_propios ?? (b.n_inmuebles_propios != null ? Number(b.n_inmuebles_propios) : null);
      const sociedad = inm.n_inmuebles_sociedad ?? (b.n_inmuebles_sociedad != null ? Number(b.n_inmuebles_sociedad) : null);

      const casas =
        inm.n_inmuebles != null ? inm.n_inmuebles
        : (propios != null || sociedad != null) ? Number(propios ?? 0) + Number(sociedad ?? 0)
        : b.n_inmuebles != null ? Number(b.n_inmuebles)
        : (b.inmuebles_urbanos != null || b.inmuebles_rusticos != null)
          ? Number(b.inmuebles_urbanos ?? 0) + Number(b.inmuebles_rusticos ?? 0)
          : null;

      const dep = sanearImporte(b.depositos);
      const val = sanearImporte(b.valores);
      const plan = sanearImporte(b.planes_pensiones);
      const deu = sanearImporte(b.deuda_pendiente);
      let patrimonio = b.patrimonio_euros != null ? sanearImporte(b.patrimonio_euros) : null;
      const patCalc = patrimonioLiquido({
        depositos: dep ?? b.depositos,
        valores: val ?? b.valores,
        planes_pensiones: plan ?? b.planes_pensiones,
        deuda_pendiente: deu ?? b.deuda_pendiente
      });
      if (patrimonio == null) patrimonio = patCalc;
      else if (patCalc != null && Math.abs(patrimonio) > 10_000_000 && Math.abs(patCalc) < Math.abs(patrimonio)) {
        patrimonio = patCalc;
      }

      const outlier = b.introducido_por === 'gemini_outlier' ||
        (patrimonio != null && (patrimonio > 10_000_000 || patrimonio < -1_000_000));

      const veh = clasificarVehiculos(b.vehiculos_detalle, b.vehiculos);
      return {
        ...d,
        patrimonio_euros: d.patrimonio_euros ?? patrimonio,
        bienes_total: d.bienes_total ?? patrimonio,
        n_inmuebles: casas,
        n_casas: casas,
        n_inmuebles_propios: propios,
        n_inmuebles_sociedad: sociedad,
        n_inmuebles_equivalentes: inm.n_inmuebles_equivalentes ?? (b.n_inmuebles_equivalentes != null ? Number(b.n_inmuebles_equivalentes) : null),
        n_viviendas: inm.n_viviendas ?? b.n_viviendas ?? null,
        n_suelo: inm.n_suelo ?? b.n_suelo ?? null,
        n_anejos: inm.n_anejos ?? b.n_anejos ?? null,
        n_productivos: inm.n_productivos ?? b.n_productivos ?? null,
        n_otros_bienes: inm.n_otros_bienes ?? b.n_otros_bienes ?? null,
        inmuebles_items: inm.items,
        n_coches: b.n_coches ?? veh.n_coches,
        n_motos: b.n_motos ?? veh.n_motos,
        n_embarcaciones: b.n_embarcaciones ?? veh.n_embarcaciones,
        n_aeronaves: b.n_aeronaves ?? veh.n_aeronaves,
        n_vehiculos: b.vehiculos ?? veh.n_vehiculos,
        vehiculos_detalle: b.vehiculos_detalle ?? null,
        vehiculos_lista: veh.vehiculos_lista,
        inmuebles_detalle: b.inmuebles_detalle ?? null,
        inmuebles_detalle_propios: b.inmuebles_detalle_propios ?? null,
        inmuebles_detalle_sociedad: b.inmuebles_detalle_sociedad ?? null,
        bienes_outlier: outlier,
        bienes_confianza: b.confianza ?? null
      };
    });
  }

  return lista;
}

export function patronBusqueda(texto) {
  return String(texto ?? '')
    .replace(/[%_*,.:()"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export async function traerVotaciones(limite = 200, filtros = {}) {
  if (filtros.id) {
    const { data, error } = await supabase.from('mv_votaciones').select('*').eq('id', filtros.id);
    if (error) throw error;
    return data ?? [];
  }
  let q = supabase.from('v_normas_completas').select('*');
  if (filtros.materia) q = q.eq('materia', filtros.materia);
  if (filtros.colectivo) q = q.contains('colectivos', [filtros.colectivo]);
  const patron = patronBusqueda(filtros.texto);
  if (patron) {
    q = q.or(`titular.ilike.*${patron}*,resumen.ilike.*${patron}*`);
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
  const patron = patronBusqueda(texto);
  if (!patron) return [];
  const { data, error } = await supabase
    .from('mv_votaciones')
    .select('*')
    .or(`titulo.ilike.*${patron}*,subtitulo.ilike.*${patron}*`)
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
  let q = supabase.from('v_promesa_estado').select('*').eq('partido', partido);
  if (soloVerificables) q = q.eq('verificable', true);
  const { data, error } = await q.order('orden').limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function traerResumenPromesas() {
  const { data, error } = await supabase.from('v_promesa_resumen').select('*');
  if (error) return null;
  const m = {};
  for (const f of data ?? []) m[String(f.siglas ?? '').trim().toUpperCase()] = f;
  return m;
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
  if (error) {
    console.error(`traerMapaPartidos: no se puede leer v_mapa_partidos (${error.message})`);
    throw error;
  }
  if (!data?.length) return [];

  const traeBase = data.some(f => f.base_economico !== undefined || f.prog_base_economico !== undefined);
  if (traeBase) return data.map(normalizarFilaMapa);

  const { data: bases, error: eBases } = await supabase.from('mv_eje_programa').select('*');
  if (eBases) {
    console.error(`traerMapaPartidos: no se puede leer mv_eje_programa (${eBases.message}). El mapa sale sin las bases de programa.`);
    return data.map(normalizarFilaMapa);
  }

  const porClave = new Map();
  for (const b of bases ?? []) {
    if (b.partido) porClave.set(String(b.partido), b);
    if (b.siglas) porClave.set(String(b.siglas), b);
  }
  return data.map(f => {
    const b = porClave.get(String(f.partido)) ?? porClave.get(String(f.siglas)) ?? null;
    if (!b) return normalizarFilaMapa(f);
    return normalizarFilaMapa({
      ...f,
      base_economico: b.base_economico,
      base_social: b.base_social,
      dimensiones_economicas: b.dimensiones_economicas,
      dimensiones_sociales: b.dimensiones_sociales
    });
  });
}

function normalizarFilaMapa(d) {
  return {
    ...d,
    prog_economico: d.prog_economico ?? d.eje_economico ?? null,
    prog_social: d.prog_social ?? d.eje_social ?? null,
    voto_economico: d.voto_economico ?? d.eje_economico ?? null,
    voto_social: d.voto_social ?? d.eje_social ?? null,
    voto_err_economico: d.voto_err_economico ?? d.err_economico ?? null,
    voto_err_social: d.voto_err_social ?? d.err_social ?? null,
    voto_n_economico: d.voto_n_economico ?? d.n_economico ?? null,
    voto_n_social: d.voto_n_social ?? d.n_social ?? null,
    voto_apoyo_gobierno: d.voto_apoyo_gobierno ?? d.apoyo_gobierno ?? null,
    voto_eco_nulo: d.voto_eco_nulo ?? d.economico_indistinguible_de_cero ?? null,
    voto_soc_nulo: d.voto_soc_nulo ?? d.social_indistinguible_de_cero ?? null,
    promesas_codificadas: d.promesas_codificadas ?? d.promesas ?? null,
    prog_base_economico: d.prog_base_economico ?? d.base_economico ?? null,
    prog_base_social: d.prog_base_social ?? d.base_social ?? null,
    prog_dims_economico: d.prog_dims_economico ?? d.dimensiones_economicas ?? null,
    prog_dims_social: d.prog_dims_social ?? d.dimensiones_sociales ?? null,
    leyes_valoradas: d.leyes_valoradas ?? d.leyes_apoyadas ?? null,
    escanos: d.escanos ?? d.diputados ?? null,
    color: d.color || d.color_hex || '#8E9299'
  };
}

export async function traerRelacionadas(norma, limite = 4) {
  if (!norma?.materia) return [];
  const { data, error } = await supabase
    .from('v_normas_completas').select('clave_norma, titular, frase_corta, resumen, fecha, materia_nombre, materia_color, total_si, total_no, resultado_final, resultado_ultima, votacion_principal')
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

export async function traerIniciativasPartido() {
  const { data, error } = await supabase.from('v_partido_iniciativas').select('*');
  if (error) return null;
  const m = {};
  for (const f of data ?? []) m[String(f.siglas ?? '').trim().toUpperCase()] = f;
  return m;
}

export async function traerVotosPorClase() {
  const { data, error } = await supabase.from('v_partido_votos').select('*');
  if (error) return null;
  const m = {};
  for (const f of data ?? []) {
    const k = String(f.siglas ?? '').trim().toUpperCase();
    (m[k] ??= []).push(f);
  }
  return m;
}

export async function traerSubejes() {
  const { data, error } = await supabase.from('v_subejes_partido').select('*');
  if (error) return null;
  const m = {};
  for (const f of data ?? []) {
    const k = String(f.siglas ?? '').trim().toUpperCase();
    (m[k] ??= []).push(f);
  }
  return m;
}

export async function traerBaseComun() {
  const { data, error } = await supabase.from('v_base_comun').select('*').eq('comun', true);
  if (error) return null;
  return new Set((data ?? []).map(f => `${f.eje}|${f.dim}`));
}

export async function traerAuditoriaEjeVotos() {
  const { data, error } = await supabase.from('v_auditoria_eje_votos').select('*').limit(1);
  if (error) return null;
  return data?.[0] ?? null;
}

export async function traerHallazgos() {
  const { data, error } = await supabase.from('v_hallazgos_publicos')
    .select('*').order('relevancia', { ascending: false, nullsFirst: false }).order('orden');
  if (error) {
    console.error(`traerHallazgos: no se puede leer v_hallazgos_publicos (${error.message}). No se enseña ningun hallazgo.`);
    return [];
  }
  return (data ?? []).filter(h => h.titular);
}

export async function traerSesgo() {
  const { data, error } = await supabase.from('v_sesgo_programas').select('*').limit(1);
  if (error) return null;
  return data?.[0] ?? null;
}

export async function traerFeed(limite = 20, desplazamiento = 0, filtros = {}) {
  let q = supabase.from('v_normas_completas').select('*');
  if (filtros.materia) q = q.eq('materia', filtros.materia);
  if (filtros.colectivo) q = q.contains('colectivos', [filtros.colectivo]);
  if (filtros.soloConResumen) q = q.not('resumen', 'is', null);
  const { data, error } = await q
    .order('fecha', { ascending: false })
    .range(desplazamiento, desplazamiento + limite - 1);
  if (error) throw error;
  return data ?? [];
}

export async function traerPromesaVsVoto() {
  let mapa = [];
  try {
    mapa = await traerMapaPartidos();
  } catch {
    return [];
  }

  const cuenta = v => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const filas = [];
  for (const p of mapa ?? []) {
    const prometido = Number(p.prog_economico);
    const votado = Number(p.voto_economico);
    if (!Number.isFinite(prometido) || !Number.isFinite(votado)) continue;
    const promesas = cuenta(p.promesas_codificadas);
    const leyes = cuenta(p.leyes_valoradas);
    if (promesas !== null && promesas < MINIMO_PROMESAS_BRECHA) continue;
    if (leyes !== null && leyes < MINIMO_LEYES_BRECHA) continue;
    filas.push({
      partido: p.partido ?? p.siglas,
      siglas: p.siglas ?? p.partido,
      color: p.color,
      prometido_gasto: prometido,
      votado_gasto: votado,
      brecha_gasto: votado - prometido,
      promesas_codificadas: promesas,
      leyes_valoradas: leyes
    });
  }

  return filas.sort((a, b) => a.prometido_gasto - b.prometido_gasto);
}

export async function traerUltimas(limite = 6) {
  const { data, error } = await supabase
    .from('v_normas_completas').select('*')
    .order('fecha', { ascending: false }).limit(limite);
  if (error) {
    console.error(`traerUltimas: no se puede leer v_normas_completas (${error.message})`);
    throw error;
  }
  return data ?? [];
}
export async function traerPerfilActual() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

const TABLA_SEGUIMIENTO = {
  iniciativa: ['seguimientos_iniciativa', 'iniciativa_id'],
  materia: ['seguimientos_materia', 'materia_id'],
  politico: ['seguimientos_politico', 'politico_id']
};

export async function seguir(tipo, id) {
  const par = TABLA_SEGUIMIENTO[tipo];
  if (!par) throw new Error(`tipo de seguimiento desconocido: ${tipo}`);
  const perfilId = await traerPerfilActual();
  if (!perfilId) return { ok: false, motivo: 'sin sesion' };
  const [tabla, columna] = par;
  const { error } = await supabase
    .from(tabla)
    .upsert({ perfil_id: perfilId, [columna]: id }, { onConflict: `perfil_id,${columna}` });
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

export async function dejarDeSeguir(tipo, id) {
  const par = TABLA_SEGUIMIENTO[tipo];
  if (!par) throw new Error(`tipo de seguimiento desconocido: ${tipo}`);
  const perfilId = await traerPerfilActual();
  if (!perfilId) return { ok: false, motivo: 'sin sesion' };
  const [tabla, columna] = par;
  const { error } = await supabase
    .from(tabla)
    .delete()
    .eq('perfil_id', perfilId)
    .eq(columna, id);
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

export async function traerSeguimientos() {
  const perfilId = await traerPerfilActual();
  if (!perfilId) return { iniciativa: [], materia: [], politico: [] };
  const [ini, mat, pol] = await Promise.all([
    supabase.from('seguimientos_iniciativa').select('iniciativa_id'),
    supabase.from('seguimientos_materia').select('materia_id'),
    supabase.from('seguimientos_politico').select('politico_id')
  ]);
  return {
    iniciativa: (ini.data ?? []).map(r => r.iniciativa_id),
    materia: (mat.data ?? []).map(r => r.materia_id),
    politico: (pol.data ?? []).map(r => r.politico_id)
  };
}

export async function traerFeedPersonal(limite = 30, desplazamiento = 0) {
  const perfilId = await traerPerfilActual();
  if (!perfilId) return [];
  const { data, error } = await supabase
    .from('v_feed_personal')
    .select('*')
    .order('fecha', { ascending: false })
    .range(desplazamiento, desplazamiento + limite - 1);
  if (error) return [];
  return data ?? [];
}

export async function enviarEnlaceAcceso(correo) {
  const limpio = String(correo ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio)) {
    return { ok: false, motivo: 'correo no valido' };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: limpio,
    options: { emailRedirectTo: window.location.origin }
  });
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

export function alCambiarSesion(callback) {
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
    callback(sesion?.user?.id ?? null);
  });
  return () => data?.subscription?.unsubscribe();
}

const VISTA_ACTIVIDAD = {
  iniciativa: 'v_actividad_iniciativa',
  materia: 'v_actividad_materia',
  politico: 'v_actividad_politico'
};

async function votacionesRecientes(vista, claves, limite) {
  const { data, error } = await supabase
    .from(vista)
    .select('votacion_id, momento, orden')
    .in('clave', claves)
    .order('momento', { ascending: false })
    .order('orden', { ascending: false })
    .limit(limite * Math.max(1, claves.length));
  if (error) return [];
  const vistos = [];
  const puestos = new Set();
  for (const f of data ?? []) {
    if (puestos.has(f.votacion_id)) continue;
    puestos.add(f.votacion_id);
    vistos.push(f);
    if (vistos.length >= limite) break;
  }
  return vistos;
}

export async function traerActividadSeguida(seguimientos, limite = 40) {
  const activos = Object.entries(VISTA_ACTIVIDAD)
    .filter(([tipo]) => (seguimientos?.[tipo] ?? []).length > 0);
  if (activos.length === 0) return [];

  const cabeceras = await Promise.all(
    activos.map(async ([tipo, vista]) => ({
      tipo,
      vista,
      claves: seguimientos[tipo],
      recientes: await votacionesRecientes(vista, seguimientos[tipo], limite)
    }))
  );

  const orden = new Map();
  for (const c of cabeceras) {
    for (const r of c.recientes) {
      const previo = orden.get(r.votacion_id);
      if (!previo || String(r.momento) > String(previo.momento)) orden.set(r.votacion_id, r);
    }
  }

  const ids = Array.from(orden.values())
    .sort((a, b) => String(b.momento).localeCompare(String(a.momento)) || (b.orden ?? 0) - (a.orden ?? 0))
    .slice(0, limite)
    .map(r => r.votacion_id);

  if (ids.length === 0) return [];

  const lotes = await Promise.all(cabeceras.map(async c => {
    const { data, error } = await supabase
      .from(c.vista)
      .select('*')
      .in('clave', c.claves)
      .in('votacion_id', ids);
    if (error) return [];
    return (data ?? []).map(f => ({ ...f, tipo: c.tipo, motivo_id: f.clave }));
  }));

  const porVotacion = new Map();
  for (const f of lotes.flat()) {
    const clave = f.votacion_id;
    if (!porVotacion.has(clave)) {
      porVotacion.set(clave, {
        votacion_id: f.votacion_id,
        iniciativa_id: f.iniciativa_id ?? null,
        titulo: f.titulo,
        subtitulo: f.subtitulo,
        fecha: f.fecha,
        momento: f.momento,
        resultado: f.resultado,
        total_si: f.total_si,
        total_no: f.total_no,
        total_abstencion: f.total_abstencion,
        similitud: f.similitud,
        materia_nombre: f.materia_nombre ?? null,
        materia_color: f.materia_color ?? null,
        motivos: [],
        seguidos: []
      });
    }
    const g = porVotacion.get(clave);
    if (g.similitud == null && f.similitud != null) g.similitud = f.similitud;
    if (!g.materia_nombre && f.materia_nombre) {
      g.materia_nombre = f.materia_nombre;
      g.materia_color = f.materia_color ?? null;
    }
    if (!g.motivos.some(m => m.tipo === f.tipo && m.id === f.clave)) {
      g.motivos.push({ tipo: f.tipo, id: f.clave, nombre: f.motivo_nombre });
    }
    if (f.tipo === 'politico' && !g.seguidos.some(x => x.id === f.clave)) {
      g.seguidos.push({
        id: f.clave,
        nombre: f.motivo_nombre,
        voto: f.voto_seguido,
        foto: f.foto_url ?? null
      });
    }
  }

  const seguidosPolitico = (seguimientos.politico ?? []).length;

  return Array.from(porVotacion.values())
    .map(g => ({
      ...g,
      faltan: Math.max(0, seguidosPolitico - g.seguidos.length),
      seguidos: g.seguidos.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))
    }))
    .sort((a, b) => String(b.momento).localeCompare(String(a.momento)));
}

export async function traerIniciativaDeVotacion(votacionId) {
  if (!votacionId) return null;
  const { data, error } = await supabase
    .from('v_enlace_fiable')
    .select('iniciativa_id')
    .eq('votacion_id', votacionId)
    .limit(1);
  if (error) return null;
  return data?.[0]?.iniciativa_id ?? null;
}

export async function traerPoliticoDeMandato(mandatoId) {
  if (!mandatoId) return null;
  const { data, error } = await supabase
    .from('mandatos')
    .select('politico_id')
    .eq('id', mandatoId)
    .limit(1);
  if (error) return null;
  return data?.[0]?.politico_id ?? null;
}

export async function traerMaterias() {
  const { data, error } = await supabase.from('materias').select('id, slug, nombre');
  if (error) return [];
  return data ?? [];
}