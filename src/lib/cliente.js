import { PostgrestClient } from '@supabase/postgrest-js';
import { clasificarVehiculos } from './vehiculos.js';
import { contarInmuebles } from './inmuebles.js';
import { sanearImporte, patrimonioLiquido } from './euros.js';

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

const REINTENTABLES = new Set([500, 502, 504, 522, 524]);
const ESPERAS_MS = [600, 1500];

function esperar(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchConReintento(entrada, opciones = {}) {
  const metodo = String(opciones?.method ?? 'GET').toUpperCase();
  const reintentable = metodo === 'GET' || metodo === 'HEAD';
  for (let intento = 0; ; intento++) {
    const respuesta = await fetch(entrada, opciones);
    if (!reintentable || intento >= ESPERAS_MS.length || !REINTENTABLES.has(respuesta.status) || opciones?.signal?.aborted) {
      return respuesta;
    }
    await respuesta.text().catch(() => null);
    await esperar(ESPERAS_MS[intento]);
  }
}

const base = url.replace(/\/$/, '');

export const supabase = faltaConfig
  ? null
  : new PostgrestClient(`${base}/rest/v1`, {
    headers: { apikey: clave, Authorization: `Bearer ${clave}` },
    fetch: fetchConReintento
  });

let conSesion = null;

async function clienteConSesion() {
  if (!conSesion) {
    const { createClient } = await import('@supabase/supabase-js');
    conSesion = createClient(base, clave, {
      auth: { persistSession: false },
      global: { fetch: fetchConReintento }
    });
  }
  return conSesion;
}

const DIEZ_MINUTOS = 10 * 60 * 1000;
const recuerdos = new Map();

function recordar(claveRecuerdo, fn, ms = DIEZ_MINUTOS) {
  const ahora = Date.now();
  const previo = recuerdos.get(claveRecuerdo);
  if (previo && ahora - previo.cuando < ms) return previo.promesa;
  const promesa = fn();
  recuerdos.set(claveRecuerdo, { cuando: ahora, promesa });
  promesa.catch(() => {
    if (recuerdos.get(claveRecuerdo)?.promesa === promesa) recuerdos.delete(claveRecuerdo);
  });
  return promesa;
}

export async function leerConRespaldo(cache, vista, armar) {
  const r = await armar(supabase.from(cache)).order('cache_fila');
  if (!r.error) return r;
  const vivo = await armar(supabase.from(vista));
  if (vivo.error) console.error(`${vista}: ${vivo.error.message} (tampoco se pudo leer ${cache}: ${r.error.message})`);
  return vivo;
}

const PAGINA = 1000;

async function leerPaginado(origen, armar, conOrden) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const q = armar(supabase.from(origen));
    const r = await (conOrden ? q.order('cache_fila') : q).range(desde, desde + PAGINA - 1);
    if (r.error) return r;
    const lote = r.data ?? [];
    filas.push(...lote);
    if (lote.length < PAGINA) return { data: filas, error: null };
  }
}

export async function leerTodoConRespaldo(cache, vista, armar) {
  const r = await leerPaginado(cache, armar, true);
  if (!r.error) return r;
  const vivo = await leerPaginado(vista, armar, false);
  if (vivo.error) console.error(`${vista}: ${vivo.error.message} (tampoco se pudo leer ${cache}: ${r.error.message})`);
  return vivo;
}

const COLUMNAS_BIENES = 'mandato_id, patrimonio_euros, n_inmuebles, n_inmuebles_propios, n_inmuebles_sociedad, n_inmuebles_equivalentes, n_viviendas, n_suelo, n_anejos, n_productivos, n_otros_bienes, inmuebles_urbanos, inmuebles_rusticos, inmuebles_detalle, inmuebles_detalle_propios, inmuebles_detalle_sociedad, depositos, valores, planes_pensiones, deuda_pendiente, vehiculos, vehiculos_detalle, n_coches, n_motos, n_embarcaciones, n_aeronaves, introducido_por, confianza';

async function leerBienes(ids) {
  const conRevision = await supabase
    .from('bienes_declarados')
    .select(`${COLUMNAS_BIENES}, inmuebles_revisado, inmuebles_nota`)
    .in('mandato_id', ids);
  if (!conRevision.error) return conRevision;
  return supabase.from('bienes_declarados').select(COLUMNAS_BIENES).in('mandato_id', ids);
}

export function traerDiputados() {
  return recordar('diputados', leerDiputados);
}

async function leerDiputados() {
  const { data, error } = await supabase
    .from('mv_diputados')
    .select('*')
    .order('eje1', { ascending: true, nullsFirst: false });
  if (error) throw error;
  let lista = data ?? [];

  const trozos = ids => {
    const salida = [];
    for (let i = 0; i < ids.length; i += 200) salida.push(ids.slice(i, i + 200));
    return salida;
  };
  const sinFoto = lista.filter(d => !d.foto_url).map(d => d.mandato_id).filter(Boolean);
  const ids = lista.map(d => d.mandato_id).filter(Boolean);

  const [respuestasFotos, respuestasBienes] = await Promise.all([
    Promise.all(trozos(sinFoto).map(chunk => supabase
      .from('mandatos')
      .select('id, foto_url, cod_parlamentario, url_ficha, url_bienes')
      .in('id', chunk))),
    Promise.all(trozos(ids).map(chunk => leerBienes(chunk)))
  ]);

  const fotos = [];
  for (const { data: filas, error } of respuestasFotos) {
    if (error) {
      console.error(`traerDiputados: no se pueden leer las fichas de mandato (${error.message}).`);
      break;
    }
    if (filas?.length) fotos.push(...filas);
  }

  const bienes = [];
  for (const { data: filas, error } of respuestasBienes) {
    if (error) {
      console.error(`traerDiputados: no se pueden leer los bienes declarados (${error.message}). Se muestran los diputados sin patrimonio.`);
      bienes.length = 0;
      break;
    }
    if (filas?.length) bienes.push(...filas);
  }

  if (sinFoto.length) {
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
        n_inmuebles_sin_porcentaje: inm.n_inmuebles_sin_porcentaje ?? null,
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
        bienes_confianza: b.confianza ?? null,
        bienes_origen: b.introducido_por ?? null,
        inmuebles_revisado: b.inmuebles_revisado ?? null,
        inmuebles_nota: b.inmuebles_nota ?? null
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
  const patron = patronBusqueda(filtros.texto);
  const { data, error } = await leerConRespaldo('mv_normas_completas', 'v_normas_completas', base => {
    let q = base.select('*');
    if (filtros.materia) q = q.eq('materia', filtros.materia);
    if (filtros.colectivo) q = q.contains('colectivos', [filtros.colectivo]);
    if (patron) q = q.or(`titular.ilike.*${patron}*,resumen.ilike.*${patron}*`);
    return q.order('fecha', { ascending: false }).limit(limite);
  });
  if (error) throw error;
  return data ?? [];
}

export async function traerVotacionesDeNorma(clave) {
  const { data, error } = await supabase.rpc('votaciones_de_norma', { p_clave: clave });
  if (error) return [];
  return data ?? [];
}

export function traerFacetas() {
  return recordar('facetas', leerFacetas);
}

async function leerFacetas() {
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

export function traerEjes() {
  return recordar('ejes', async () => {
    const { data, error } = await supabase
      .from('ejes_calculados')
      .select('*')
      .order('numero');
    if (error) throw error;
    return data ?? [];
  });
}

export function traerCobertura() {
  return recordar('cobertura', async () => {
    const { data, error } = await supabase.from('mv_cobertura').select('*').limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  });
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

export function traerProgramas() {
  return recordar('programas', async () => {
    const { data, error } = await supabase.from('v_programas').select('*').order('promesas', { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function traerPromesas(partido, soloVerificables = false, limite = 200) {
  return recordar(`promesas:${partido}:${soloVerificables}:${limite}`, async () => {
    const { data, error } = await leerConRespaldo('mv_promesa_estado', 'v_promesa_estado', base => {
      let q = base.select('*').eq('partido', partido);
      if (soloVerificables) q = q.eq('verificable', true);
      return q.order('orden').limit(limite);
    });
    if (error) throw error;
    return data ?? [];
  });
}

export function traerProgramasInicio() {
  return recordar('programasInicio', async () => {
    const { data, error } = await leerConRespaldo('mv_programas_inicio', 'v_programas_inicio', q => q.select('*'));
    if (error) throw error;
    return (data ?? []).filter(f => Number(f.promesas ?? 0) > 0);
  });
}

export function traerResumenPromesas() {
  return recordar('resumenPromesas', async () => {
    const { data, error } = await leerConRespaldo('mv_promesa_resumen', 'v_promesa_resumen', q => q.select('*'));
    if (error) throw error;
    const m = {};
    for (const f of data ?? []) m[String(f.siglas ?? '').trim().toUpperCase()] = f;
    return m;
  }).catch(() => null);
}

export function traerCoherencia() {
  return recordar('coherencia', async () => {
    const { data, error } = await supabase
      .from('mv_coherencia').select('*').order('pct_coherencia', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  }).catch(() => []);
}

export function traerDestacadas(limite = 5) {
  return recordar(`destacadas:${limite}`, async () => {
    const { data, error } = await supabase
      .from('mv_destacadas').select('*').order('relevancia', { ascending: false }).limit(limite);
    if (error) throw error;
    return data ?? [];
  }).catch(() => []);
}

export function traerLideres(metrica) {
  return recordar(`lideres:${metrica}`, async () => {
    const { data, error } = await supabase
      .from('mv_lider_partido').select('*').eq('metrica', metrica).order('valor', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }).catch(() => []);
}

export function traerMapaPartidos() {
  return recordar('mapa', leerMapaPartidos);
}

async function leerMapaPartidos() {
  const { data, error } = await leerConRespaldo('mv_mapa_partidos', 'v_mapa_partidos', q => q.select('*'));
  if (error) {
    console.error(`traerMapaPartidos: no se puede leer el mapa (${error.message})`);
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
  const { data, error } = await leerConRespaldo('mv_normas_completas', 'v_normas_completas', q => q
    .select('clave_norma, titular, frase_corta, resumen, fecha, materia_nombre, materia_color, total_si, total_no, resultado_final, resultado_ultima, resultado_fiable, votaciones, votacion_principal')
    .eq('materia', norma.materia)
    .neq('clave_norma', norma.clave_norma ?? '')
    .order('fecha', { ascending: false })
    .limit(30));
  if (error) return [];
  return (data ?? [])
    .filter(n => !(n.resultado_fiable === false && Number(n.votaciones ?? 1) > 1))
    .filter(n => (n.resultado_final ?? n.resultado_ultima) === 'aprobada')
    .slice(0, limite);
}

export async function traerActividades(mandatoId) {
  const { data, error } = await supabase.rpc('actividades_de_diputado', { p_mandato_id: mandatoId });
  if (error) return [];
  return data ?? [];
}

export function traerIniciativasPartido() {
  return recordar('iniciativasPartido', async () => {
    const { data, error } = await leerConRespaldo('mv_partido_iniciativas', 'v_partido_iniciativas', q => q.select('*'));
    if (error) throw error;
    const m = {};
    for (const f of data ?? []) m[String(f.siglas ?? '').trim().toUpperCase()] = f;
    return m;
  }).catch(() => null);
}

export function traerVotosPorClase() {
  return recordar('votosPorClase', async () => {
    const { data, error } = await leerConRespaldo('mv_partido_votos', 'v_partido_votos', q => q.select('*'));
    if (error) throw error;
    const m = {};
    for (const f of data ?? []) {
      const k = String(f.siglas ?? '').trim().toUpperCase();
      (m[k] ??= []).push(f);
    }
    return m;
  }).catch(() => null);
}

export function traerSubejes() {
  return recordar('subejes', async () => {
    const { data, error } = await leerConRespaldo('mv_subejes_partido', 'v_subejes_partido', q => q.select('*'));
    if (error) throw error;
    const m = {};
    for (const f of data ?? []) {
      const k = String(f.siglas ?? '').trim().toUpperCase();
      (m[k] ??= []).push(f);
    }
    return m;
  }).catch(() => null);
}

export function traerBaseComun() {
  return recordar('baseComun', async () => {
    const { data, error } = await leerConRespaldo('mv_base_comun', 'v_base_comun', q => q.select('*').eq('comun', true));
    if (error) throw error;
    return new Set((data ?? []).map(f => `${f.eje}|${f.dim}`));
  }).catch(() => null);
}

export function traerAuditoriaEjeVotos() {
  return recordar('auditoriaEjeVotos', async () => {
    const { data, error } = await leerConRespaldo('mv_auditoria_eje_votos', 'v_auditoria_eje_votos', q => q.select('*').limit(1));
    if (error) throw error;
    return data?.[0] ?? null;
  }).catch(() => null);
}

export function traerHallazgos() {
  return recordar('hallazgos', async () => {
    const { data, error } = await leerConRespaldo('mv_hallazgos_publicos', 'v_hallazgos_publicos', q => q
      .select('*').order('relevancia', { ascending: false, nullsFirst: false }).order('orden'));
    if (error) throw error;
    return (data ?? []).filter(h => h.titular);
  }).catch(e => {
    console.error(`traerHallazgos: no se pueden leer los hallazgos (${e?.message ?? e}). No se enseña ninguno.`);
    return [];
  });
}

export function traerSesgo() {
  return recordar('sesgo', async () => {
    const { data, error } = await leerConRespaldo('mv_sesgo_programas', 'v_sesgo_programas', q => q.select('*').limit(1));
    if (error) throw error;
    return data?.[0] ?? null;
  }).catch(() => null);
}

export async function traerFeed(limite = 20, desplazamiento = 0, filtros = {}) {
  const { data, error } = await leerConRespaldo('mv_normas_completas', 'v_normas_completas', base => {
    let q = base.select('*');
    if (filtros.materia) q = q.eq('materia', filtros.materia);
    if (filtros.colectivo) q = q.contains('colectivos', [filtros.colectivo]);
    if (filtros.soloConResumen) q = q.not('resumen', 'is', null);
    return q.order('fecha', { ascending: false }).range(desplazamiento, desplazamiento + limite - 1);
  });
  if (error) throw error;
  return data ?? [];
}

export function traerUltimas(limite = 6) {
  return recordar(`ultimas:${limite}`, async () => {
    const { data, error } = await leerConRespaldo('mv_normas_completas', 'v_normas_completas', q => q
      .select('*').order('fecha', { ascending: false }).limit(limite));
    if (error) {
      console.error(`traerUltimas: no se pueden leer las normas (${error.message})`);
      throw error;
    }
    return data ?? [];
  });
}
export async function traerPerfilActual() {
  const cliente = await clienteConSesion();
  const { data } = await cliente.auth.getUser();
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
  const cliente = await clienteConSesion();
  const { error } = await cliente
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
  const cliente = await clienteConSesion();
  const { error } = await cliente
    .from(tabla)
    .delete()
    .eq('perfil_id', perfilId)
    .eq(columna, id);
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

export async function traerSeguimientos() {
  const perfilId = await traerPerfilActual();
  if (!perfilId) return { iniciativa: [], materia: [], politico: [] };
  const cliente = await clienteConSesion();
  const [ini, mat, pol] = await Promise.all([
    cliente.from('seguimientos_iniciativa').select('iniciativa_id'),
    cliente.from('seguimientos_materia').select('materia_id'),
    cliente.from('seguimientos_politico').select('politico_id')
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
  const cliente = await clienteConSesion();
  const { data, error } = await cliente
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
  const cliente = await clienteConSesion();
  const { error } = await cliente.auth.signInWithOtp({
    email: limpio,
    options: { emailRedirectTo: window.location.origin }
  });
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

export async function cerrarSesion() {
  const cliente = await clienteConSesion();
  const { error } = await cliente.auth.signOut();
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

export function alCambiarSesion(callback) {
  let vivo = true;
  let cancelar = null;
  clienteConSesion().then(cliente => {
    if (!vivo) return;
    const { data } = cliente.auth.onAuthStateChange((_evento, sesion) => {
      callback(sesion?.user?.id ?? null);
    });
    cancelar = () => data?.subscription?.unsubscribe();
  });
  return () => {
    vivo = false;
    cancelar?.();
  };
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