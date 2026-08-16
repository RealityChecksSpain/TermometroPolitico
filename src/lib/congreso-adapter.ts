import { db } from './supabase';
import { descargarHtml, extraerUrls, BASE_CONGRESO } from './descubrir';
import { normalizarNombre, clavesBusqueda, parsearFechaCongreso } from './texto';

export { normalizarNombre, clavesBusqueda, parsearFechaCongreso };

import { UA as USER_AGENT } from './descubrir';

export interface VotacionJson {
  informacion: {
    sesion: number;
    numeroVotacion: number;
    fecha: string;
    titulo: string;
    textoExpediente: string;
    tituloSubGrupo: string;
    textoSubGrupo: string;
    votacionesConjuntas: unknown[];
  };
  totales: {
    asentimiento: string;
    presentes: number;
    afavor: number;
    enContra: number;
    abstenciones: number;
    noVotan: number;
  };
  votaciones: {
    asiento: string;
    diputado: string;
    grupo: string;
    voto: string;
  }[];
}

const MAPA_GRUPOS: Record<string, string> = {
  'GS': 'psoe',
  'GP': 'pp',
  'GVOX': 'vox',
  'GSUMAR': 'sumar',
  'GR': 'erc',
  'GJxCAT': 'junts',
  'GEH Bildu': 'bildu',
  'GV (EAJ-PNV)': 'pnv',
  'GMx': 'MIXTO_REQUIERE_RESOLUCION'
};

const MAPA_VOTOS: Record<string, string> = {
  'Sí': 'si',
  'Si': 'si',
  'No': 'no',
  'Abstención': 'abstencion',
  'Abstencion': 'abstencion',
  'No vota': 'no_vota'
};




export interface ResultadoValidacion {
  valida: boolean;
  errores: string[];
  avisos: string[];
}

export function validarVotacion(json: VotacionJson): ResultadoValidacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  const t = json.totales;
  const filas = json.votaciones ?? [];

  if (!json.informacion) errores.push('Falta el bloque informacion');
  if (!t) errores.push('Falta el bloque totales');
  if (errores.length) return { valida: false, errores, avisos };

  const esAsentimiento = t.asentimiento === 'Sí' || t.asentimiento === 'Si';

  if (esAsentimiento) {
    if (filas.length > 0) avisos.push('Votación por asentimiento con votos individuales');
    return { valida: true, errores, avisos };
  }

  if (filas.length === 0) {
    errores.push('Votación nominal sin votos individuales');
    return { valida: false, errores, avisos };
  }

  const suma = t.afavor + t.enContra + t.abstenciones;
  if (suma !== t.presentes) {
    errores.push(`afavor+enContra+abstenciones=${suma} no cuadra con presentes=${t.presentes}`);
  }

  const contados = { si: 0, no: 0, abstencion: 0, no_vota: 0 };
  const votosDesconocidos = new Set<string>();
  filas.forEach(f => {
    const v = MAPA_VOTOS[f.voto];
    if (!v) {
      votosDesconocidos.add(f.voto);
      return;
    }
    contados[v as keyof typeof contados]++;
  });

  if (votosDesconocidos.size > 0) {
    errores.push(`Valores de voto no reconocidos: ${Array.from(votosDesconocidos).join(', ')}`);
  }
  if (contados.si !== t.afavor) errores.push(`Sí contados ${contados.si} != declarados ${t.afavor}`);
  if (contados.no !== t.enContra) errores.push(`No contados ${contados.no} != declarados ${t.enContra}`);
  if (contados.abstencion !== t.abstenciones) {
    errores.push(`Abstenciones contadas ${contados.abstencion} != declaradas ${t.abstenciones}`);
  }
  if (contados.no_vota !== t.noVotan) {
    errores.push(`No vota contados ${contados.no_vota} != declarados ${t.noVotan}`);
  }

  const gruposDesconocidos = new Set(
    filas.map(f => f.grupo).filter(g => !(g in MAPA_GRUPOS))
  );
  if (gruposDesconocidos.size > 0) {
    avisos.push(`Grupos no mapeados: ${Array.from(gruposDesconocidos).join(', ')}`);
  }

  return { valida: errores.length === 0, errores, avisos };
}

export interface EnlaceVotacion {
  legislatura: string;
  sesion: number;
  fechaSesion: string;
  numeroVotacion: number;
  urlJson: string;
}

export const LEGISLATURAS: Record<string, string> = {
  XV: 'Leg15',
  XIV: 'Leg14',
  XIII: 'Leg13',
  XII: 'Leg12',
  XI: 'Leg11',
  X: 'Leg10'
};

export function urlCalendario(fechaIso: string, legislatura = 'XV'): string {
  const [a, m, d] = fechaIso.split('-');
  const targetDate = `${d}/${m}/${a}`;
  return (
    `${BASE_CONGRESO}/es/opendata/votaciones` +
    '?p_p_id=votaciones&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view' +
    `&targetLegislatura=${legislatura}&targetDate=${encodeURIComponent(targetDate)}`
  );
}

function parsearEnlaces(html: string, legDir: string, fechaCompacta: string | null): EnlaceVotacion[] {
  const urls = extraerUrls(
    html,
    /webpublica\/opendata\/votaciones\/Leg\d+\/Sesion\d+\/\d{8}\/Votacion\d+\/VOT_\d+\.json/
  );

  const detalle = /\/votaciones\/(Leg\d+)\/Sesion(\d+)\/(\d{8})\/Votacion(\d+)\//;
  const salida: EnlaceVotacion[] = [];

  for (const urlJson of urls) {
    const m = urlJson.match(detalle);
    if (!m) continue;
    const [, leg, sesion, fecha, votacion] = m;
    if (leg !== legDir) continue;
    if (fechaCompacta && fecha !== fechaCompacta) continue;
    salida.push({
      legislatura: leg,
      sesion: parseInt(sesion, 10),
      fechaSesion: `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`,
      numeroVotacion: parseInt(votacion, 10),
      urlJson
    });
  }

  salida.sort((a, b) => a.numeroVotacion - b.numeroVotacion);
  return salida;
}

export async function descubrirVotacionesDeFecha(
  fechaIso: string,
  legislatura = 'XV'
): Promise<EnlaceVotacion[]> {
  const legDir = LEGISLATURAS[legislatura] ?? 'Leg15';
  const html = await descargarHtml(urlCalendario(fechaIso, legislatura));
  return parsearEnlaces(html, legDir, fechaIso.replace(/-/g, ''));
}

export async function descubrirVotaciones(legislatura = 'Leg15'): Promise<EnlaceVotacion[]> {
  const html = await descargarHtml(`${BASE_CONGRESO}/es/opendata/votaciones`);
  const salida = parsearEnlaces(html, legislatura, null);
  if (salida.length === 0) {
    throw new Error(
      `No se encontro ninguna votacion de ${legislatura}. El Congreso pudo cambiar el listado.`
    );
  }
  return salida;
}

export function rangoFechas(desde: string, hasta: string, soloLaborables = true): string[] {
  const salida: string[] = [];
  const d = new Date(desde + 'T12:00:00Z');
  const fin = new Date(hasta + 'T12:00:00Z');
  while (d <= fin) {
    const dia = d.getUTCDay();
    if (!soloLaborables || (dia >= 1 && dia <= 5)) {
      salida.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return salida;
}

export async function descargarVotacion(url: string): Promise<VotacionJson> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${url} devolvió ${res.status}`);
  return (await res.json()) as VotacionJson;
}

interface MandatoResuelto {
  mandatoId: string;
  partidoSlug: string | null;
  alta: string;
  baja: string | null;
}

export function vigenteEn(m: MandatoResuelto, fechaIso: string): boolean {
  if (m.alta && fechaIso < m.alta) return false;
  if (m.baja && fechaIso > m.baja) return false;
  return true;
}

export function elegirMandato(
  candidatos: MandatoResuelto[],
  fechaIso: string
): MandatoResuelto | undefined {
  if (candidatos.length === 0) return undefined;
  if (candidatos.length === 1) return candidatos[0];
  return candidatos.find(m => vigenteEn(m, fechaIso)) ?? candidatos[0];
}

async function cargarIndiceMandatos(
  legislaturaId: string
): Promise<Map<string, MandatoResuelto[]>> {
  const indice = new Map<string, MandatoResuelto[]>();
  const tam = 1000;
  let desde = 0;

  for (;;) {
    const { data, error } = await db()
      .from('mandatos')
      .select('id, partido_id, partido_efectivo_id, fecha_alta, fecha_baja, politicos!inner(nombre, apellidos)')
      .eq('legislatura_id', legislaturaId)
      .range(desde, desde + tam - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    data.forEach((row: any) => {
      const completo = `${row.politicos.apellidos}, ${row.politicos.nombre}`;
      const resuelto: MandatoResuelto = {
        mandatoId: row.id,
        partidoSlug: row.partido_efectivo_id ?? row.partido_id ?? null,
        alta: row.fecha_alta,
        baja: row.fecha_baja
      };
      clavesBusqueda(completo).forEach(clave => {
        const lista = indice.get(clave);
        if (lista) {
          if (!lista.some(m => m.mandatoId === resuelto.mandatoId)) lista.push(resuelto);
        } else {
          indice.set(clave, [resuelto]);
        }
      });
    });

    if (data.length < tam) break;
    desde += tam;
  }

  return indice;
}

export interface ResultadoProceso {
  url: string;
  estado: 'ok' | 'rechazada' | 'error';
  votosInsertados: number;
  sinResolver: string[];
  errores: string[];
  avisos: string[];
}

export async function procesarVotacion(
  enlace: EnlaceVotacion,
  legislaturaId: string,
  indice: Map<string, MandatoResuelto[]>
): Promise<ResultadoProceso> {
  const base: ResultadoProceso = {
    url: enlace.urlJson,
    estado: 'ok',
    votosInsertados: 0,
    sinResolver: [],
    errores: [],
    avisos: []
  };

  let json: VotacionJson;
  try {
    json = await descargarVotacion(enlace.urlJson);
  } catch (e) {
    return { ...base, estado: 'error', errores: [String(e)] };
  }

  const validacion = validarVotacion(json);
  base.avisos = validacion.avisos;
  if (!validacion.valida) {
    return { ...base, estado: 'rechazada', errores: validacion.errores };
  }

  const fecha = parsearFechaCongreso(json.informacion.fecha);

  const { data: sesion, error: errSesion } = await db()
    .from('sesiones')
    .upsert(
      {
        legislatura_id: legislaturaId,
        numero: String(json.informacion.sesion),
        fecha,
        organo: 'Pleno',
        diario_url: null
      },
      { onConflict: 'legislatura_id,numero,fecha,organo' }
    )
    .select('id')
    .single();

  if (errSesion) return { ...base, estado: 'error', errores: [errSesion.message] };

  const { data: votacion, error: errVotacion } = await db()
    .from('votaciones')
    .upsert(
      {
        sesion_id: sesion.id,
        orden: json.informacion.numeroVotacion,
        titulo: json.informacion.titulo,
        subtitulo: json.informacion.textoExpediente || null,
        fecha: `${fecha}T00:00:00Z`,
        total_si: json.totales.afavor,
        total_no: json.totales.enContra,
        total_abstencion: json.totales.abstenciones,
        total_no_vota: json.totales.noVotan,
        total_presentes: json.totales.presentes,
        resultado: json.totales.afavor > json.totales.enContra ? 'aprobada' : 'rechazada',
        es_nominal: json.totales.asentimiento !== 'Sí',
        fuente_url: enlace.urlJson
      },
      { onConflict: 'sesion_id,orden' }
    )
    .select('id')
    .single();

  if (errVotacion) return { ...base, estado: 'error', errores: [errVotacion.message] };

  const filas: any[] = [];
  const pendientes: any[] = [];

  json.votaciones.forEach(v => {
    const voto = MAPA_VOTOS[v.voto];
    if (!voto) return;

    let resuelto: MandatoResuelto | undefined;
    for (const clave of clavesBusqueda(v.diputado)) {
      const candidatos = indice.get(clave);
      if (candidatos && candidatos.length > 0) {
        resuelto = elegirMandato(candidatos, fecha);
        break;
      }
    }

    if (!resuelto) {
      base.sinResolver.push(v.diputado);
      pendientes.push({
        votacion_id: votacion.id,
        nombre_origen: v.diputado,
        grupo_origen: v.grupo,
        voto_origen: v.voto,
        asiento_origen: v.asiento,
        motivo: 'nombre_no_encontrado',
        fuente_url: enlace.urlJson
      });
      return;
    }

    const grupoSlug = MAPA_GRUPOS[v.grupo];
    if (grupoSlug === 'MIXTO_REQUIERE_RESOLUCION' && !resuelto.partidoSlug) {
      pendientes.push({
        votacion_id: votacion.id,
        nombre_origen: v.diputado,
        grupo_origen: v.grupo,
        voto_origen: v.voto,
        asiento_origen: v.asiento,
        motivo: 'mixto_sin_partido_asignado',
        fuente_url: enlace.urlJson
      });
    }

    filas.push({
      votacion_id: votacion.id,
      mandato_id: resuelto.mandatoId,
      voto,
      telematico: v.asiento === '-1'
    });
  });

  if (filas.length > 0) {
    const { error } = await db()
      .from('votos')
      .upsert(filas, { onConflict: 'votacion_id,mandato_id' });
    if (error) return { ...base, estado: 'error', errores: [error.message] };
    base.votosInsertados = filas.length;
  }

  if (pendientes.length > 0) {
    await db().from('cola_revision').insert(pendientes);
  }

  return base;
}

export interface ResumenIngesta {
  fechasConsultadas: number;
  descubiertas: number;
  nuevas: number;
  procesadas: number;
  conError: number;
  nombresSinResolver: string[];
  errores: string[];
}

export async function ingestarFechas(
  fechas: string[],
  legislaturaId: string,
  legislatura = 'XV',
  opciones: { pausaMs?: number; alProgreso?: (i: number, total: number, fecha: string, n: number) => void } = {}
): Promise<ResumenIngesta> {
  const { pausaMs = 700, alProgreso } = opciones;
  const inicio = new Date().toISOString();

  const { data: camara } = await db()
    .from('camaras')
    .select('id, permite_scraping')
    .eq('slug', 'congreso')
    .single();

  if (!camara?.permite_scraping) throw new Error('La camara no permite acceso automatizado');

  const { data: existentes } = await db().from('votaciones').select('fuente_url');
  const yaTenemos = new Set((existentes ?? []).map(r => r.fuente_url));

  const indice = await cargarIndiceMandatos(legislaturaId);

  let descubiertas = 0;
  const resultados: ResultadoProceso[] = [];
  const errores: string[] = [];

  for (let i = 0; i < fechas.length; i++) {
    const fecha = fechas[i];
    let enlaces: EnlaceVotacion[] = [];
    try {
      enlaces = await descubrirVotacionesDeFecha(fecha, legislatura);
    } catch (e) {
      errores.push(`${fecha}: ${e}`);
    }

    descubiertas += enlaces.length;
    alProgreso?.(i + 1, fechas.length, fecha, enlaces.length);

    const nuevos = enlaces.filter(e => !yaTenemos.has(e.urlJson));
    for (const enlace of nuevos) {
      const r = await procesarVotacion(enlace, legislaturaId, indice);
      resultados.push(r);
      yaTenemos.add(enlace.urlJson);
      if (r.estado !== 'ok') errores.push(`${enlace.urlJson}: ${r.errores.join('; ')}`);
      await new Promise(res => setTimeout(res, pausaMs));
    }

    await new Promise(res => setTimeout(res, pausaMs));
  }

  const conError = resultados.filter(r => r.estado !== 'ok').length;

  await db().from('etl_runs').insert({
    camara_id: camara.id,
    recurso: 'votaciones',
    estado: conError === 0 ? 'ok' : conError < resultados.length ? 'parcial' : 'error',
    registros_leidos: descubiertas,
    registros_insertados: resultados.reduce((a, r) => a + r.votosInsertados, 0),
    registros_actualizados: 0,
    error_detalle: errores.length ? JSON.stringify(errores.slice(0, 20)) : null,
    iniciado_at: inicio,
    finalizado_at: new Date().toISOString()
  });

  if (conError === 0) {
    await db().rpc('registrar_exito_etl', { p_camara_id: camara.id, p_recurso: 'votaciones' });
  }

  return {
    fechasConsultadas: fechas.length,
    descubiertas,
    nuevas: resultados.length,
    procesadas: resultados.filter(r => r.estado === 'ok').length,
    conError,
    nombresSinResolver: Array.from(new Set(resultados.flatMap(r => r.sinResolver))),
    errores: errores.slice(0, 20)
  };
}

export async function ejecutarIngesta(legislaturaId: string, legislatura = 'XV', diasAtras = 10) {
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setUTCDate(desde.getUTCDate() - diasAtras);
  const fechas = rangoFechas(desde.toISOString().slice(0, 10), hoy.toISOString().slice(0, 10));
  return ingestarFechas(fechas, legislaturaId, legislatura);
}