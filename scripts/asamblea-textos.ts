import type { Page } from 'playwright-core';
import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { refrescarCaches } from '../src/lib/metricas';
import { abrirNavegador, cargar, enlaces, lineas, bajarPdf, esperar } from '../src/lib/navegador';
import { lineasPdf } from '../src/lib/andalucia';

exigirEnv('SUPABASE_URL');

const BASE = 'https://www.asambleamadrid.es';
const CAMARA = 'asamblea-madrid';
const LEGISLATURA = 13;
const PAUSA_MS = 2500;
const argv = process.argv.slice(2);
const OCULTO = argv.includes('--oculto');
const RELEER = argv.includes('--releer');
const LIMITE = Number(argv.find(a => a.startsWith('--limite='))?.slice(9) ?? Infinity);
const TIPO = argv.find(a => a.startsWith('--tipo='))?.slice(7) ?? null;

const NOMBRE_TIPO: Record<string, string> = { PL: 'Proyecto de ley', PROPL: 'Proposición de ley', PNL: 'Proposición no de ley' };

interface Documento { fecha: string | null; etiqueta: string; descripcion: string; url: string }

function fechaIso(t: string | null | undefined): string | null {
  const m = String(t ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function tras(ls: string[], etiqueta: RegExp): string | null {
  const i = ls.findIndex(l => etiqueta.test(l));
  return i >= 0 && ls[i + 1] ? ls[i + 1] : null;
}

function leerFicha(ls: string[], clave: string) {
  const pc = patronClave(clave);
  const i = ls.findIndex(l => l === clave || (pc.test(l) && l.length < 40));
  if (i < 0) return null;
  const fin = ls.findIndex((l, k) => k > i && /^Estado:?$/i.test(l));
  const bloque = ls.slice(i + 1, fin > i ? fin : i + 2);
  const numero = bloque.find(l => /^N[úu]mero (?:Ley|Resoluci[óo]n):/i.test(l)) ?? null;
  const texto = bloque.filter(l => l !== numero).join(' ').replace(/\s+/g, ' ').trim();
  const ia = ls.findIndex(l => /^Autores?$/i.test(l));
  const id = ls.findIndex((l, k) => k > ia && /^(Destinatario|Tramitaci[óo]n)$/i.test(l));
  return {
    numero: numero ? numero.replace(/^N[úu]mero /i, '') : null,
    texto,
    estado: tras(ls, /^Estado:?$/i),
    apertura: fechaIso(tras(ls, /^Documento de apertura:?$/i)),
    procedimiento: tras(ls, /^Procedimiento:?$/i),
    organo: tras(ls, /^[ÓO]rgano:?$/i),
    autores: ia >= 0 ? ls.slice(ia + 1, id > ia ? id : ia + 2) : []
  };
}

function documentos(es: { texto: string; href: string }[]): Documento[] {
  const vistos = new Set<string>();
  const salida: Documento[] = [];
  for (const e of es) {
    if (!/\/static\/docs?\//i.test(e.href)) continue;
    const m = e.texto.match(/^(.*?)\s*\((\d{2}\/\d{2}\/\d{4})\)\s*(.*)$/);
    if (!m) continue;
    const clave = `${e.href}|${e.texto}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({ fecha: fechaIso(m[2]), etiqueta: m[1].trim(), descripcion: m[3].trim(), url: e.href });
  }
  return salida;
}

function paginasBoam(d: Documento): [number, number] | null {
  const m = d.descripcion.match(/desde la p[áa]gina\s+(\d+)\s+hasta la p[áa]gina\s+(\d+)/i);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function porPaginas(ls: string[]): string[][] {
  const paginas: string[][] = [[]];
  for (const l of ls) {
    if (l === '\f') paginas.push([]);
    else paginas[paginas.length - 1].push(l);
  }
  return paginas.filter((p, i) => p.length || i < paginas.length - 1);
}

function desfase(paginas: string[][]): number | null {
  const votos = new Map<number, number>();
  paginas.forEach((p, i) => {
    const bordes = [...p.slice(0, 4), ...p.slice(-4)];
    const vistos = new Set<number>();
    for (const l of bordes) for (const n of l.match(/\b\d{1,6}\b/g) ?? []) {
      const d = Number(n) - i;
      if (vistos.has(d)) continue;
      vistos.add(d);
      votos.set(d, (votos.get(d) ?? 0) + 1);
    }
  });
  const [mejor, n] = [...votos].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return mejor != null && n >= Math.max(2, paginas.length * 0.5) ? mejor : null;
}

function patronClave(clave: string): RegExp {
  const m = clave.match(/^([A-Z]+)-(\d+)\/(\d{4})$/);
  return m ? new RegExp(`\\b${m[1]}-${m[2]}\\s*(?:\\(XIII\\))?\\s*\\/\\s*${m[3]}\\b`) : new RegExp(clave.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
}

const CABECERA_BOAM = /\b[A-Z]{1,6}-\d+\s*\(XIII\)\s*\/\s*\d{4}\s+RGEP/;
const RUIDO_BOAM = /^(?:BOLET[ÍI]N OFICIAL DE LA ASAMBLEA DE MADRID.*|N[úu]m\.\s*\d+\s*\/?\s*\d{1,2} de \w+ de \d{4}|\d{1,6}|[─—_-]{3,})$/i;

function recortar(texto: string[], clave: string): string {
  const pc = patronClave(clave);
  const limpias = texto.map(l => l.trim()).filter(l => l && !RUIDO_BOAM.test(l));
  let ini = limpias.findIndex(l => pc.test(l) && /RGEP/.test(l));
  if (ini < 0) ini = limpias.findIndex(l => pc.test(l));
  if (ini < 0) ini = 0;
  let fin = limpias.length;
  for (let j = ini + 1; j < limpias.length; j++) {
    if (CABECERA_BOAM.test(limpias[j]) && !pc.test(limpias[j])) { fin = j; break; }
  }
  return limpias.slice(ini, fin).join('\n').replace(/-\n(?=[a-záéíóúñü])/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

const pdfCache = new Map<string, string[][]>();
async function paginasDe(page: Page, url: string): Promise<string[][] | null> {
  if (pdfCache.has(url)) return pdfCache.get(url)!;
  const buf = await bajarPdf(page, url);
  if (!buf) return null;
  const pags = porPaginas(await lineasPdf(new Uint8Array(buf)));
  if (pdfCache.size > 12) pdfCache.delete(pdfCache.keys().next().value!);
  pdfCache.set(url, pags);
  await esperar(800);
  return pags;
}

async function textoBoam(page: Page, d: Documento, clave: string): Promise<string | null> {
  const rango = paginasBoam(d);
  if (!rango) return null;
  const pags = await paginasDe(page, d.url);
  if (!pags) return null;
  const off = desfase(pags);
  if (off == null) return null;
  const desde = rango[0] - off;
  const hasta = rango[1] - off;
  if (desde < 0 || hasta >= pags.length || hasta < desde) return null;
  const texto = recortar(pags.slice(desde, hasta + 1).flat(), clave);
  return texto.length > 300 ? texto : null;
}

async function textoRegistro(page: Page, d: Documento): Promise<string | null> {
  const pags = await paginasDe(page, d.url);
  if (!pags) return null;
  const texto = pags.flat().map(l => l.trim()).join('\n').replace(/-\n(?=[a-záéíóúñü])/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return texto.length > 300 ? texto : null;
}

async function elegirTexto(page: Page, siglas: string, aprobada: boolean, docs: Documento[], clave: string, fichaTexto: string) {
  const boams = docs.filter(d => /^B\.O\.A\.M\./i.test(d.etiqueta) && paginasBoam(d));
  const registros = docs.filter(d => /^RGEP\d/i.test(d.etiqueta));
  if (aprobada && siglas !== 'PNL') {
    for (const d of boams.filter(x => /aprobaci[óo]n de la ley/i.test(`${x.etiqueta} ${x.descripcion}`))) {
      const t = await textoBoam(page, d, clave);
      if (t) return { texto: t, clase: 'ley', doc: d };
    }
  }
  if (aprobada && siglas === 'PNL') {
    for (const d of [...boams].reverse()) {
      const t = await textoBoam(page, d, clave);
      if (t && /aprob/i.test(t)) return { texto: t, clase: 'aprobado', doc: d };
      break;
    }
  }
  if (siglas === 'PNL' && fichaTexto.length > 200) return { texto: fichaTexto, clase: 'presentado', doc: registros[0] ?? null };
  for (const d of boams.slice(0, 1)) {
    const t = await textoBoam(page, d, clave);
    if (t) return { texto: t, clase: 'presentado', doc: d };
  }
  for (const d of registros.slice(0, 1)) {
    const t = await textoRegistro(page, d);
    if (t) return { texto: t, clase: 'presentado', doc: d };
  }
  return null;
}

async function main() {
  const avisoOriginal = console.warn;
  console.warn = (...args: any[]) => {
    if (/TT: (?:undefined function|invalid function id)|glyf|Required .* table/i.test(String(args[0] ?? ''))) return;
    avisoOriginal(...args);
  };
  console.log(`\nTEXTOS DE INICIATIVAS DE LA ASAMBLEA DE MADRID  ${new Date().toISOString()}\n`);
  const web = await traerTodo<{ clave: string; id_web: number }>((a, b) =>
    db().from('asamblea_iniciativa_web').select('clave, id_web').order('clave').range(a, b));
  const inis = await traerTodo<any>((a, b) => db().from('asamblea_iniciativas')
    .select('clave, siglas, estado, resultado').eq('legislatura', LEGISLATURA).in('siglas', ['PL', 'PROPL', 'PNL']).order('clave').range(a, b));
  const porClave = new Map(inis.map((i: any) => [i.clave, i]));
  const previas = await traerTodo<any>((a, b) => db().from('parl_iniciativas')
    .select('expediente, estado').eq('camara', CAMARA).order('expediente').range(a, b));
  const leidas = new Map(previas.map((p: any) => [p.expediente, p.estado]));
  const todas = web.filter(w => porClave.has(w.clave) && (!TIPO || porClave.get(w.clave).siglas === TIPO));
  const pendientes = todas.filter(w => RELEER || !leidas.has(w.clave) || !/TRAMITADA|DECA|RETIRA|NO ADMITIDA|ARCHIVA/i.test(String(leidas.get(w.clave) ?? '')));
  const tanda = pendientes.slice(0, LIMITE);
  console.log(`Iniciativas con página: ${todas.length} · ya leídas: ${leidas.size} · a leer ahora: ${tanda.length}`);
  if (!tanda.length) { console.log('Nada que leer.\n'); return; }

  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  const cuenta: Record<string, number> = { ley: 0, aprobado: 0, presentado: 0, sinTexto: 0, sinFicha: 0 };
  const muestras = new Map<string, string>();
  const sinTexto: string[] = [];
  let lote: any[] = [];
  const guardar = async () => {
    if (!lote.length) return;
    const { error } = await db().from('parl_iniciativas').upsert(lote, { onConflict: 'camara,expediente' });
    if (error) throw new Error(`parl_iniciativas: ${error.message}`);
    lote = [];
  };

  for (const [n, w] of tanda.entries()) {
    const ini = porClave.get(w.clave);
    const url = `${BASE}/actividad/iniciativa?iniciativa=${w.id_web}`;
    if (!(await cargar(page, url))) { cuenta.sinFicha++; continue; }
    await esperar(PAUSA_MS);
    const ficha = leerFicha(await lineas(page), w.clave);
    if (!ficha) { cuenta.sinFicha++; console.log(`  ${w.clave}: la página no trae la ficha`); continue; }
    const docs = documentos(await enlaces(page));
    const aprobada = /APROBAD/i.test(`${ficha.estado ?? ''} ${ini.resultado ?? ''}`);
    let elegido = null;
    try { elegido = await elegirTexto(page, ini.siglas, aprobada, docs, w.clave, ficha.texto); } catch (e) { console.log(`  ${w.clave}: ${(e as Error).message}`); }
    if (elegido) {
      cuenta[elegido.clase]++;
      if (!muestras.has(`${ini.siglas}-${elegido.clase}`)) muestras.set(`${ini.siglas}-${elegido.clase}`, `${w.clave}: ${elegido.texto.slice(0, 260).replace(/\n/g, ' ')} … ${elegido.texto.slice(-160).replace(/\n/g, ' ')}`);
    } else { cuenta.sinTexto++; sinTexto.push(w.clave); }
    lote.push({
      camara: CAMARA,
      legislatura: LEGISLATURA,
      expediente: w.clave,
      tipo: ini.siglas,
      tipo_nombre: NOMBRE_TIPO[ini.siglas] ?? ini.siglas,
      proponente: ficha.autores.join(', ') || null,
      extracto: ficha.texto || null,
      procedimiento: ficha.procedimiento,
      estado: [ficha.estado, ficha.numero].filter(Boolean).join(' · ') || null,
      fecha_creacion: ficha.apertura,
      comision: ficha.organo,
      materias_parlamento: [],
      tramites: docs.map(d => ({ fecha: d.fecha, descripcion: d.descripcion || d.etiqueta, organo: null, enlaces: [{ texto: d.etiqueta, url: d.url }] })),
      url_ficha: url,
      texto_url: elegido?.doc?.url ?? (elegido ? url : null),
      texto_fuente: elegido?.doc ? `${elegido.doc.etiqueta}${elegido.doc.fecha ? ` - ${elegido.doc.fecha.split('-').reverse().join('/')}` : ''}` : elegido ? 'ficha de la iniciativa' : null,
      texto_clase: elegido?.clase ?? null,
      texto_extraido: elegido?.texto ?? null,
      texto_chars: elegido?.texto.length ?? 0,
      leido_at: new Date().toISOString()
    });
    if (lote.length >= 20) await guardar();
    if ((n + 1) % 20 === 0) console.log(`  ${n + 1}/${tanda.length}`);
  }
  await guardar();
  await navegador.close();

  console.log('\nRESULTADO');
  console.log(`  ley aprobada (BOAM): ${cuenta.ley} · texto aprobado: ${cuenta.aprobado} · texto presentado: ${cuenta.presentado}`);
  console.log(`  sin texto: ${cuenta.sinTexto}${sinTexto.length ? ` (${sinTexto.slice(0, 12).join(', ')}${sinTexto.length > 12 ? '…' : ''})` : ''} · página sin ficha: ${cuenta.sinFicha}`);
  console.log('\nMUESTRAS (inicio … final de cada tipo de texto)');
  for (const [k, t] of muestras) console.log(`  [${k}] ${t}\n`);
  await refrescarCaches();
  console.log('\nSiguiente: npm run asamblea:resumir -- --limite 10\n');
}

main().catch(e => {
  console.error(`\nERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
