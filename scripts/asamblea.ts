import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Page } from 'playwright-core';
import { db, exigirEnv } from '../src/lib/supabase';
import { abrirNavegador, bajarPdf, cargar, enlaces, esperar, lineas } from '../src/lib/navegador';
import { leerDeclaracionPdf } from '../src/lib/leer-declaracion';
import { contarInmuebles } from '../src/lib/inmuebles.js';
import { sanearDeclaracion, patrimonioLiquido, motivoAnomalia } from '../src/lib/euros.js';

exigirEnv('SUPABASE_URL');

const BASE = 'https://www.asambleamadrid.es';
const LEGISLATURA = 13;
const PAUSA_MS = 3000;
const argv = process.argv.slice(2);
const opcion = (k: string) => argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const LIMITE = Number(opcion('limite') ?? Infinity);
const SIN_BIENES = argv.includes('--sin-bienes');
const RELEER = argv.includes('--releer');
const OCULTO = argv.includes('--oculto');
const COPIAS = resolve(opcion('copias') ?? '../asamblea-sondeo/bienes');

const PARTIDO_DE_GRUPO: [RegExp, string][] = [
  [/popular/i, 'pp'],
  [/m[aá]s madrid/i, 'masmadrid'],
  [/socialista/i, 'psoe'],
  [/vox/i, 'vox']
];

interface Ficha {
  id: number;
  nombre: string;
  url: string;
  grupo: string | null;
  circunscripcion: string | null;
  email: string | null;
  cargos: string | null;
  declaraciones: { url: string; tipo: string; fecha: string | null }[];
}

function fechaIso(dmy: string | undefined | null): string | null {
  const m = dmy?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function limpiarNombre(t: string): string {
  return t.replace(/m[aá]s informaci[oó]n( sobre)?/gi, '').replace(/\s+/g, ' ').trim();
}

async function listarDiputados(page: Page): Promise<Map<number, string>> {
  const vistos = new Map<number, string>();
  let url: string | null = `${BASE}/composicion/diputados`;
  const recorridas = new Set<string>();
  while (url && !recorridas.has(url) && recorridas.size < 20) {
    recorridas.add(url);
    if (!(await cargar(page, url))) throw new Error(`No carga la lista de diputados: ${url}`);
    const lista = await enlaces(page);
    for (const e of lista) {
      const m = e.href.match(/ficha-del-diputado\?diputado=(\d+)/);
      if (!m) continue;
      const nombre = limpiarNombre(e.texto);
      const id = Number(m[1]);
      if (nombre && (!vistos.has(id) || nombre.length < (vistos.get(id) ?? '').length)) vistos.set(id, nombre);
    }
    const sig = lista.find(e => /^siguiente$/i.test(e.texto) && !e.href.endsWith('#'));
    url = sig?.href ?? null;
    console.log(`  lista: ${vistos.size} diputados`);
    await esperar(PAUSA_MS);
  }
  return vistos;
}

async function leerFicha(page: Page, id: number, nombre: string): Promise<Ficha | null> {
  const url = `${BASE}/composicion/diputados/ficha-del-diputado?diputado=${id}&legislatura=${LEGISLATURA}`;
  if (!(await cargar(page, url))) return null;
  const ls = await lineas(page);
  const iGrupo = ls.findIndex(l => /^Grupo Parlamentario/i.test(l));
  const email = ls.find(l => /@asambleamadrid\.es$/i.test(l)) ?? null;
  const iCargos = ls.findIndex(l => /^Cargos en la Asamblea$/i.test(l));
  const cargos: string[] = [];
  if (iCargos >= 0) {
    for (let k = iCargos + 1; k < ls.length - 1; k++) {
      if (/^Actividad parlamentaria$|^Legislatura [IVXL]+$/i.test(ls[k])) break;
      if (/\d{4}\s*-\s*\.\.\.$/.test(ls[k]) && !/^Diputad[oa]\b/i.test(ls[k + 1])) cargos.push(ls[k + 1]);
    }
  }
  const declaraciones = (await enlaces(page))
    .filter(e => /\.pdf(\?|$)/i.test(e.href) && /declaraci[oó]n|acuerdo/i.test(e.texto))
    .map(e => ({
      url: e.href,
      tipo: e.texto.replace(/\s*\(\d{2}\/\d{2}\/\d{4}\)\s*$/, '').trim(),
      fecha: fechaIso(e.texto.match(/\((\d{2}\/\d{2}\/\d{4})\)/)?.[1])
    }));
  return {
    id,
    nombre,
    url,
    grupo: iGrupo >= 0 ? ls[iGrupo] : null,
    circunscripcion: iGrupo >= 0 && ls[iGrupo + 1] && /^[A-ZÁÉÍÓÚÑ ]+$/.test(ls[iGrupo + 1]) ? ls[iGrupo + 1] : null,
    email,
    cargos: cargos.length ? [...new Set(cargos)].join('; ') : null,
    declaraciones: [...new Map(declaraciones.map(d => [d.url, d])).values()]
  };
}

async function partidos(): Promise<Map<string, string>> {
  const { data, error } = await db().from('partidos').select('id, slug').in('slug', PARTIDO_DE_GRUPO.map(p => p[1]));
  if (error) throw error;
  return new Map((data ?? []).map(p => [p.slug, p.id]));
}

function partidoDe(grupo: string | null, mapa: Map<string, string>): string | null {
  if (!grupo) return null;
  const par = PARTIDO_DE_GRUPO.find(([re]) => re.test(grupo));
  return par ? mapa.get(par[1]) ?? null : null;
}

function ultimaDeBienes(f: Ficha) {
  return f.declaraciones
    .filter(d => /bienes/i.test(d.tipo) && !/actividad/i.test(d.tipo))
    .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')))[0] ?? null;
}

async function leerBienes(page: Page, f: Ficha): Promise<string> {
  const decl = ultimaDeBienes(f);
  if (!decl) return 'sin declaración de bienes publicada';
  if (!RELEER) {
    const { data } = await db().from('asamblea_bienes').select('url_declaracion').eq('id_asamblea', f.id).maybeSingle();
    if (data?.url_declaracion === decl.url) return 'ya leída';
  }
  const buf = await bajarPdf(page, decl.url);
  if (!buf) return `no se pudo bajar ${decl.url}`;
  await writeFile(join(COPIAS, `${f.id}-${decl.url.split('/').pop()}`), buf);
  let lectura = await leerDeclaracionPdf(buf, 'de la Asamblea de Madrid');
  if (!lectura.ok) {
    await esperar(8000);
    lectura = await leerDeclaracionPdf(buf, 'de la Asamblea de Madrid');
  }
  if (!lectura.ok || !lectura.datos) return `lectura fallida: ${lectura.error}`;
  const d: any = sanearDeclaracion(lectura.datos);
  const inm = contarInmuebles(null, d.inmuebles_urbanos, d.inmuebles_rusticos, d.inmuebles_detalle_propios, d.inmuebles_detalle_sociedad);
  const sinInmuebles = [d.inmuebles_urbanos, d.inmuebles_rusticos, d.inmuebles_detalle_propios, d.inmuebles_detalle_sociedad].every(v => v == null || v === '');
  if (sinInmuebles && d.confianza !== 'baja') {
    Object.assign(inm, {
      n_inmuebles: 0, n_inmuebles_propios: 0, n_inmuebles_sociedad: 0, n_inmuebles_equivalentes: 0,
      n_viviendas: 0, n_viviendas_propias: 0, n_viviendas_equivalentes: 0,
      n_suelo: 0, n_anejos: 0, n_productivos: 0, n_otros_bienes: 0
    });
  }
  const anomalia = motivoAnomalia(d);
  const dudas = [...(Array.isArray(d.dudas) ? d.dudas : []), ...(anomalia ? [`anomalía: ${anomalia}`] : []), ...(sinInmuebles ? ['sin inmuebles declarados: las tres tablas de inmuebles están vacías'] : [])];
  const fila = {
    id_asamblea: f.id,
    url_declaracion: decl.url,
    fecha_declaracion: d.fecha_declaracion ?? decl.fecha,
    rendimientos_trabajo: d.rendimientos_trabajo,
    rendimientos_capital: d.rendimientos_capital,
    rendimientos_actividades: d.rendimientos_actividades,
    rentas_detalle: d.rentas_detalle,
    irpf_pagado: d.irpf_pagado,
    inmuebles_urbanos: d.inmuebles_urbanos,
    inmuebles_rusticos: d.inmuebles_rusticos,
    inmuebles_detalle_propios: d.inmuebles_detalle_propios,
    inmuebles_detalle_sociedad: d.inmuebles_detalle_sociedad,
    depositos: d.depositos,
    valores: d.valores,
    planes_pensiones: d.planes_pensiones,
    vehiculos: d.vehiculos,
    vehiculos_detalle: d.vehiculos_detalle,
    prestamos_concedido: d.prestamos_concedido,
    deuda_pendiente: d.deuda_pendiente,
    observaciones: d.observaciones,
    patrimonio_euros: patrimonioLiquido(d),
    n_inmuebles: inm.n_inmuebles,
    n_inmuebles_propios: inm.n_inmuebles_propios,
    n_inmuebles_sociedad: inm.n_inmuebles_sociedad,
    n_inmuebles_equivalentes: inm.n_inmuebles_equivalentes,
    n_viviendas: inm.n_viviendas,
    n_viviendas_propias: inm.n_viviendas_propias,
    n_viviendas_equivalentes: inm.n_viviendas_equivalentes,
    n_suelo: inm.n_suelo,
    n_anejos: inm.n_anejos,
    n_productivos: inm.n_productivos,
    n_otros_bienes: inm.n_otros_bienes,
    confianza: anomalia ? 'baja' : d.confianza,
    dudas: dudas.length ? dudas.join(' | ') : null,
    modelo: lectura.modelo ?? null,
    leido_at: new Date().toISOString()
  };
  const { error } = await db().from('asamblea_bienes').upsert(fila, { onConflict: 'id_asamblea' });
  if (error) return `error al guardar: ${error.message}`;
  return `leída (${fila.confianza}): ${inm.n_inmuebles ?? '?'} inmuebles, ${inm.n_viviendas_equivalentes ?? '?'} viviendas equivalentes`;
}

async function main() {
  console.log(`\nASAMBLEA DE MADRID  ${new Date().toISOString()}\n`);
  if (!SIN_BIENES) {
    exigirEnv('GEMINI_API_KEY');
    await mkdir(COPIAS, { recursive: true });
  }
  const mapaPartidos = await partidos();
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();

  const lista = await listarDiputados(page);
  if (lista.size < 100) {
    await navegador.close();
    throw new Error(`Solo salen ${lista.size} diputados en la lista; la Asamblea tiene 135. No escribo nada.`);
  }

  const fichas: Ficha[] = [];
  let n = 0;
  for (const [id, nombre] of lista) {
    if (n++ >= LIMITE) break;
    process.stdout.write(`[${n}/${Math.min(lista.size, LIMITE)}] ${nombre}… `);
    const f = await leerFicha(page, id, nombre);
    await esperar(PAUSA_MS);
    if (!f) { console.log('ficha no disponible'); continue; }
    fichas.push(f);
    const { error } = await db().from('asamblea_diputados').upsert({
      id_asamblea: f.id,
      legislatura: LEGISLATURA,
      nombre_completo: f.nombre,
      grupo: f.grupo,
      partido_id: partidoDe(f.grupo, mapaPartidos),
      circunscripcion: f.circunscripcion,
      email: f.email,
      cargos: f.cargos,
      url_ficha: f.url,
      activo: true,
      actualizado_at: new Date().toISOString()
    }, { onConflict: 'id_asamblea' });
    if (error) { console.log(`error: ${error.message}`); continue; }
    if (f.declaraciones.length) {
      const { error: e2 } = await db().from('asamblea_declaraciones').upsert(
        f.declaraciones.map(d => ({ url: d.url, id_asamblea: f.id, tipo: d.tipo, fecha: d.fecha })), { onConflict: 'url' });
      if (e2) console.log(`aviso declaraciones: ${e2.message}`);
    }
    if (SIN_BIENES) { console.log(`${f.grupo ?? 'sin grupo'} · ${f.declaraciones.length} documentos`); continue; }
    console.log(await leerBienes(page, f));
    await esperar(PAUSA_MS);
  }

  if (LIMITE === Infinity && fichas.length >= 100) {
    const ids = [...lista.keys()];
    const { error } = await db().from('asamblea_diputados').update({ activo: false }).not('id_asamblea', 'in', `(${ids.join(',')})`);
    if (error) console.log(`aviso al marcar bajas: ${error.message}`);
  }

  await navegador.close();

  const { data: resumen } = await db().from('v_asamblea_diputados').select('partido_siglas, url_declaracion, fiable').eq('activo', true);
  const porPartido = new Map<string, { n: number; leidas: number; fiables: number }>();
  for (const r of resumen ?? []) {
    const k = r.partido_siglas ?? 'SIN PARTIDO';
    const v = porPartido.get(k) ?? { n: 0, leidas: 0, fiables: 0 };
    v.n++;
    if (r.url_declaracion) v.leidas++;
    if (r.url_declaracion && r.fiable) v.fiables++;
    porPartido.set(k, v);
  }
  console.log('\nRESUMEN (activos · declaraciones leídas · fiables)');
  for (const [k, v] of porPartido) console.log(`  ${k.padEnd(12)} ${String(v.n).padStart(3)} · ${String(v.leidas).padStart(3)} · ${String(v.fiables).padStart(3)}`);
  const { data: hallazgos } = await db().from('v_asamblea_hallazgos').select('titular');
  console.log('\nHALLAZGOS DE MADRID');
  for (const h of hallazgos ?? []) console.log(`  · ${h.titular}`);
  if (!hallazgos?.length) console.log('  ninguno pasa todavía los umbrales');
  console.log('\nFIN. Pega el resumen en el chat. Los PDF se quedan fuera del repo, en', COPIAS);
}

main().catch(e => { console.error(e); process.exit(1); });
