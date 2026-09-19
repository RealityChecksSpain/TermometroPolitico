import { db } from './supabase.js';
import { descargarHtml, extraerUrls, descargarJson, BASE_CONGRESO } from './descubrir.js';
import { normalizarNombre, clavesBusqueda, parsearFechaCongreso } from './texto.js';
import { mayoriaRequerida, resultadoDe, nombreMayoria, umbralDe } from './mayorias.js';

export { normalizarNombre, clavesBusqueda, parsearFechaCongreso };

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

function esAsentimiento(totales: VotacionJson['totales']): boolean {
  return totales.asentimiento === 'Sí' || totales.asentimiento === 'Si';
}

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

  if (esAsentimiento(t)) {
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

function comprobarEstructura(html: string, url: string): void {
  if (!/opendata\/votaciones/i.test(html)) {
    throw new Error(
      `${url}: la página no contiene la sección de votaciones (${html.length} caracteres). ` +
      'El Congreso ha cambiado el listado o ha devuelto un reto de navegador.'
    );
  }
}

export async function descubrirVotacionesDeFecha(
  fechaIso: string,
  legislatura = 'XV'
): Promise<EnlaceVotacion[]> {
  const legDir = LEGISLATURAS[legislatura] ?? 'Leg15';
  const url = urlCalendario(fechaIso, legislatura);
  const html = await descargarHtml(url);
  comprobarEstructura(html, url);
  return parsearEnlaces(html, legDir, fechaIso.replace(/-/g, ''));
}

export async function descubrirVotaciones(legislatura = 'Leg15'): Promise<EnlaceVotacion[]> {
  const url = `${BASE_CONGRESO}/es/opendata/votaciones`;
  const html = await descargarHtml(url);
  comprobarEstructura(html, url);
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
  return descargarJson<VotacionJson>(url);
}

interface MandatoResuelto {
  mandatoId: string;
  partidoSlug: string | null;
  alta: string;
  baja: string | null;
}

export interface IndiceMandatos {
  estricto: Map<string, MandatoResuelto[]>;
  laxo: Map<string, MandatoResuelto[]>;
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
  return candidatos.find(m => vigenteEn(m, fechaIso));
}

export function clavesPorNivel(nombre: string): { estrictas: string[]; laxas: string[] } {
  const norm = normalizarNombre(nombre);
  const [apellidos = '', propio = ''] = norm.split(',').map(s => s.trim());
  const estrictas = [norm];
  const laxas: string[] = [];
  if (apellidos && propio) {
    const completa = `${propio} ${apellidos}`;
    if (!estrictas.includes(completa)) estrictas.push(completa);
    const corta = `${propio.split(' ')[0]} ${apellidos.split(' ')[0]}`;
    if (!estrictas.includes(corta)) laxas.push(corta);
  }
  return { estrictas, laxas };
}

function anadir(mapa: Map<string, MandatoResuelto[]>, clave: string, m: MandatoResuelto) {
  const lista = mapa.get(clave);
  if (!lista) {
    mapa.set(clave, [m]);
    return;
  }
  if (!lista.some(x => x.mandatoId === m.mandatoId)) lista.push(m);
}

async function cargarIndiceMandatos(legislaturaId: string): Promise<IndiceMandatos> {
  const indice: IndiceMandatos = { estricto: new Map(), laxo: new Map() };
  const tam = 1000;
  let desde = 0;

  for (;;) {
    const { data, error } = await db()
      .from('mandatos')
      .select('id, partido_id, partido_efectivo_id, fecha_alta, fecha_baja, politicos!inner(nombre, apellidos)')
      .eq('legislatura_id', legislaturaId)
      .order('id')
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
      const { estrictas, laxas } = clavesPorNivel(completo);
      estrictas.forEach(c => {
        anadir(indice.estricto, c, resuelto);
        anadir(indice.laxo, c, resuelto);
      });
      laxas.forEach(c => anadir(indice.laxo, c, resuelto));
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

interface Atribucion {
  mandato?: MandatoResuelto;
  nota: string | null;
}

function atribuir(nombre: string, indice: IndiceMandatos, fecha: string): Atribucion {
  const { estrictas, laxas } = clavesPorNivel(nombre);

  for (const clave of estrictas) {
    const candidatos = indice.estricto.get(clave);
    if (!candidatos || candidatos.length === 0) continue;
    const elegido = elegirMandato(candidatos, fecha);
    if (!elegido) return { nota: 'homonimos sin mandato vigente en la fecha' };
    if (!vigenteEn(elegido, fecha)) {
      return { mandato: elegido, nota: 'voto fuera de las fechas del mandato' };
    }
    return { mandato: elegido, nota: null };
  }

  for (const clave of [...estrictas, ...laxas]) {
    const candidatos = indice.laxo.get(clave);
    if (!candidatos || candidatos.length === 0) continue;
    if (candidatos.length > 1) return { nota: 'nombre ambiguo por coincidencia parcial' };
    const elegido = candidatos[0];
    return {
      mandato: elegido,
      nota: vigenteEn(elegido, fecha)
        ? 'atribuido por coincidencia parcial del nombre'
        : 'coincidencia parcial y voto fuera de las fechas del mandato'
    };
  }

  return { nota: null };
}

export async function procesarVotacion(
  enlace: EnlaceVotacion,
  legislaturaId: string,
  indice: IndiceMandatos
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
  const asentimiento = esAsentimiento(json.totales);
  const textos = {
    titulo: json.informacion.titulo,
    subtitulo: json.informacion.textoExpediente || null,
    total_si: json.totales.afavor,
    total_no: json.totales.enContra
  };
  const mayoria = mayoriaRequerida(textos);
  const resultado = resultadoDe(textos);
  if (!asentimiento && umbralDe(mayoria) !== null) {
    base.avisos = [
      ...base.avisos,
      `exige ${nombreMayoria(mayoria)} (${umbralDe(mayoria)} síes): ${json.totales.afavor} a favor, ${resultado}`
    ];
  }

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
        resultado: asentimiento ? 'aprobada' : resultado,
        es_nominal: !asentimiento,
        fuente_url: enlace.urlJson
      },
      { onConflict: 'sesion_id,orden' }
    )
    .select('id')
    .single();

  if (errVotacion) return { ...base, estado: 'error', errores: [errVotacion.message] };

  const filas: any[] = [];
  const pendientes: any[] = [];
  const notas = new Set<string>();

  json.votaciones.forEach(v => {
    const voto = MAPA_VOTOS[v.voto];
    if (!voto) return;

    const { mandato, nota } = atribuir(v.diputado, indice, fecha);
    if (nota) notas.add(`${v.diputado}: ${nota}`);

    if (!mandato) {
      base.sinResolver.push(v.diputado);
      pendientes.push({
        votacion_id: votacion.id,
        nombre_origen: v.diputado,
        grupo_origen: v.grupo,
        voto_origen: v.voto,
        asiento_origen: v.asiento,
        motivo: 'nombre_no_encontrado',
        nota,
        fuente_url: enlace.urlJson
      });
      return;
    }

    const grupoSlug = MAPA_GRUPOS[v.grupo];
    if (grupoSlug === 'MIXTO_REQUIERE_RESOLUCION' && !mandato.partidoSlug) {
      pendientes.push({
        votacion_id: votacion.id,
        nombre_origen: v.diputado,
        grupo_origen: v.grupo,
        voto_origen: v.voto,
        asiento_origen: v.asiento,
        motivo: 'mixto_sin_partido_asignado',
        nota: null,
        fuente_url: enlace.urlJson
      });
    }

    filas.push({
      votacion_id: votacion.id,
      mandato_id: mandato.mandatoId,
      voto,
      telematico: v.asiento === '-1'
    });
  });

  if (notas.size > 0) base.avisos = [...base.avisos, ...Array.from(notas).slice(0, 10)];

  if (filas.length > 0) {
    const { error } = await db()
      .from('votos')
      .upsert(filas, { onConflict: 'votacion_id,mandato_id' });
    if (error) return { ...base, estado: 'error', errores: [error.message] };
    base.votosInsertados = filas.length;
  }

  if (pendientes.length > 0) {
    const { error } = await db().from('cola_revision').insert(pendientes);
    if (error) {
      return { ...base, estado: 'error', errores: [`cola_revision: ${error.message}`] };
    }
  }

  return base;
}

export interface ResumenIngesta {
  fechasConsultadas: number;
  fechasConError: number;
  descubiertas: number;
  nuevas: number;
  procesadas: number;
  conError: number;
  estado: 'ok' | 'parcial' | 'error';
  plazoAgotado: boolean;
  nombresSinResolver: string[];
  errores: string[];
}

async function urlsConocidas(urls: string[]): Promise<Set<string>> {
  const conocidas = new Set<string>();
  for (let i = 0; i < urls.length; i += 40) {
    const lote = urls.slice(i, i + 40);
    const { data, error } = await db().from('votaciones').select('fuente_url').in('fuente_url', lote);
    if (error) throw error;
    (data ?? []).forEach((r: any) => conocidas.add(r.fuente_url));
  }
  return conocidas;
}

export async function ingestarFechas(
  fechas: string[],
  legislaturaId: string,
  legislatura = 'XV',
  opciones: {
    pausaMs?: number;
    plazoMs?: number;
    alProgreso?: (i: number, total: number, fecha: string, n: number) => void;
  } = {}
): Promise<ResumenIngesta> {
  const { pausaMs = 700, plazoMs, alProgreso } = opciones;
  const arranque = Date.now();
  const inicio = new Date().toISOString();
  const sinPlazo = () => plazoMs === undefined || Date.now() - arranque < plazoMs;

  const { data: camara, error: errCamara } = await db()
    .from('camaras')
    .select('id, permite_scraping')
    .eq('slug', 'congreso')
    .single();

  if (errCamara) throw new Error(`No se puede leer la camara congreso: ${errCamara.message}`);
  if (!camara?.permite_scraping) throw new Error('La camara no permite acceso automatizado');

  const indice = await cargarIndiceMandatos(legislaturaId);

  let descubiertas = 0;
  let fechasConsultadas = 0;
  let fechasConError = 0;
  let plazoAgotado = false;
  const resultados: ResultadoProceso[] = [];
  const errores: string[] = [];

  for (let i = 0; i < fechas.length; i++) {
    if (!sinPlazo()) {
      plazoAgotado = true;
      errores.push(`plazo agotado tras ${fechasConsultadas} de ${fechas.length} fechas`);
      break;
    }

    const fecha = fechas[i];
    let enlaces: EnlaceVotacion[] = [];
    try {
      enlaces = await descubrirVotacionesDeFecha(fecha, legislatura);
      fechasConsultadas++;
    } catch (e) {
      fechasConError++;
      errores.push(`${fecha}: ${e}`);
      await new Promise(res => setTimeout(res, pausaMs));
      continue;
    }

    descubiertas += enlaces.length;
    alProgreso?.(i + 1, fechas.length, fecha, enlaces.length);

    const yaTenemos = enlaces.length ? await urlsConocidas(enlaces.map(e => e.urlJson)) : new Set<string>();
    const nuevos = enlaces.filter(e => !yaTenemos.has(e.urlJson));

    for (const enlace of nuevos) {
      if (!sinPlazo()) {
        plazoAgotado = true;
        errores.push(`plazo agotado dentro de ${fecha}`);
        break;
      }
      const r = await procesarVotacion(enlace, legislaturaId, indice);
      resultados.push(r);
      if (r.estado !== 'ok') errores.push(`${enlace.urlJson}: ${r.errores.join('; ')}`);
      await new Promise(res => setTimeout(res, pausaMs));
    }

    if (plazoAgotado) break;
    await new Promise(res => setTimeout(res, pausaMs));
  }

  const conError = resultados.filter(r => r.estado !== 'ok').length;
  const todoFalla = resultados.length > 0 && conError === resultados.length;
  const ningunaFecha = fechasConsultadas === 0 && fechas.length > 0;

  const estado: ResumenIngesta['estado'] =
    ningunaFecha || todoFalla ? 'error'
    : fechasConError > 0 || conError > 0 || plazoAgotado ? 'parcial'
    : 'ok';

  const { error: errRun } = await db().from('etl_runs').insert({
    camara_id: camara.id,
    recurso: 'votaciones',
    estado,
    registros_leidos: descubiertas,
    registros_insertados: resultados.reduce((a, r) => a + r.votosInsertados, 0),
    registros_actualizados: 0,
    error_detalle: errores.length ? JSON.stringify(errores.slice(0, 20)) : null,
    iniciado_at: inicio,
    finalizado_at: new Date().toISOString()
  });
  if (errRun) throw new Error(`No se ha podido registrar la ejecucion en etl_runs: ${errRun.message}`);

  if (estado === 'ok') {
    const { error: errExito } = await db().rpc('registrar_exito_etl', {
      p_camara_id: camara.id,
      p_recurso: 'votaciones'
    });
    if (errExito) errores.push(`registrar_exito_etl: ${errExito.message}`);
  }

  return {
    fechasConsultadas,
    fechasConError,
    descubiertas,
    nuevas: resultados.length,
    procesadas: resultados.filter(r => r.estado === 'ok').length,
    conError,
    estado,
    plazoAgotado,
    nombresSinResolver: Array.from(new Set(resultados.flatMap(r => r.sinResolver))),
    errores: errores.slice(0, 20)
  };
}

export async function ejecutarIngesta(
  legislaturaId: string,
  legislatura = 'XV',
  diasAtras = 10,
  opciones: { plazoMs?: number } = {}
) {
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setUTCDate(desde.getUTCDate() - diasAtras);
  const fechas = rangoFechas(desde.toISOString().slice(0, 10), hoy.toISOString().slice(0, 10));
  return ingestarFechas(fechas, legislaturaId, legislatura, opciones);
}