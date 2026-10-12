import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Page } from 'playwright-core';
import { extractText, getDocumentProxy } from 'unpdf';
import { abrirNavegador, bajarPdf, cargar, enlaces, esperar, lineas } from '../src/lib/navegador';
import { leerCsv, legislaturaDe } from '../src/lib/asamblea-csv';

const BASE = 'https://www.asambleamadrid.es';
const OPENDATA = `${BASE}/static/doc/opendata`;
const PAUSA_MS = 3500;
const COPIAS = resolve(process.argv.find(a => a.startsWith('--copias='))?.slice(9) ?? '../asamblea-sondeo/diarios');
const OCULTO = process.argv.includes('--oculto');
const salida: string[] = [];

function decir(t = '') {
  console.log(t);
  salida.push(t);
}

async function csv(page: Page, nombre: string) {
  for (const ruta of [join(COPIAS, '..', nombre), join(COPIAS, nombre)]) {
    try { return leerCsv(await readFile(ruta, 'utf8')); } catch {}
  }
  const res = await page.context().request.get(`${OPENDATA}/${nombre}`, { timeout: 300000 });
  if (!res.ok()) return [];
  const texto = (await res.body()).toString('utf8');
  await writeFile(join(COPIAS, nombre), texto);
  await esperar(PAUSA_MS);
  return leerCsv(texto);
}

async function textoPdf(page: Page, url: string): Promise<string | null> {
  const buf = await bajarPdf(page, url);
  await esperar(PAUSA_MS);
  if (!buf) return null;
  await writeFile(join(COPIAS, url.split('/').pop()!.split('?')[0]), buf);
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(buf)), { mergePages: true });
  return String(text).replace(/\s+/g, ' ');
}

function votaciones(t: string, max = 8) {
  const re = /(resultado de la votaci[oó]n|votos a favor|queda(n)? (aprobad|rechazad)|con los votos|se aprueba|se rechaza|sometid[ao] a votaci[oó]n)/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(t)) && n < max) {
    decir(`  … ${t.slice(Math.max(0, m.index - 250), m.index + 450)} …`);
    re.lastIndex = m.index + 450;
    n++;
  }
  if (!n) decir('  no aparece ninguna fórmula de votación');
}

async function main() {
  await mkdir(COPIAS, { recursive: true });
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  if (!(await cargar(page, `${BASE}/servicios/datos-abiertos`))) throw new Error('No carga la página de datos abiertos');
  await esperar(PAUSA_MS);

  const exp = await csv(page, 'ARCHIVO.F_PRINCIPALES_OPENDATA_VIEW.csv');
  decir(`\n=== EXPEDIENTES: ${exp.length} filas`);
  if (exp.length) {
    decir(`  columnas: ${Object.keys(exp[0]).join(', ')}`);
    const pcop = exp.find(f => f.SIGLAS === 'PCOP' && f.EXP_REG === '3211' && f.EXP_ANO === '2026');
    decir(`  PCOP-3211/2026: ${JSON.stringify(pcop ?? 'no está')}`);
    const contiene = pcop ? Object.entries(pcop).filter(([, v]) => v.includes('490725')) : [];
    decir(`  columnas con 490725: ${contiene.map(([k]) => k).join(', ') || 'ninguna'}`);
  }

  const dsam = (await csv(page, 'SGP_ADMIN.OPENDATA_DSAM_VIEW.csv')).filter(f => legislaturaDe(f.LEGISLATURA) === 13);
  decir(`\n=== DIARIOS XIII: ${dsam.length}`);
  for (const f of dsam.filter(f => /pleno/i.test(f.ORGANO)).slice(-4)) decir(`  ${JSON.stringify(f)}`);

  if (await cargar(page, `${BASE}/actividad/iniciativa?iniciativa=490725`)) {
    const ls = await lineas(page);
    const i = ls.findIndex(l => /PCOP-3211/.test(l));
    decir(`\n=== PÁGINA DE INICIATIVA (sin redirect): ${await page.title()}`);
    decir(`  ${ls.slice(Math.max(0, i - 2), i + 60).join(' | ').slice(0, 2500)}`);
    for (const e of (await enlaces(page)).filter(e => /\.pdf|diario|boam|ds_|votaci/i.test(e.href)).slice(0, 15)) decir(`  ${e.texto.slice(0, 60).padEnd(60)}  ${e.href}`);
  }
  await esperar(PAUSA_MS);

  if (await cargar(page, `${BASE}/servicios/publicaciones`)) {
    decir(`\n=== PUBLICACIONES: ${await page.title()}`);
    for (const e of (await enlaces(page)).filter(e => e.href.startsWith(BASE) && /\.pdf|diario|boletin|boam|dsam|publicaci/i.test(`${e.href} ${e.texto}`)).slice(0, 30)) decir(`  ${e.texto.slice(0, 60).padEnd(60)}  ${e.href}`);
  }
  await esperar(PAUSA_MS);

  if (await cargar(page, `${BASE}/actividad/sesiones`)) {
    const pdfs = (await enlaces(page)).filter(e => /\/static\/doc\/actas\/.*\.pdf/i.test(e.href));
    decir(`\n=== ACTAS EN LA PÁGINA DE SESIONES: ${pdfs.length}`);
    for (const e of pdfs) decir(`  ${e.texto.slice(0, 70).padEnd(70)}  ${e.href}`);
    const elegidas = [...pdfs.filter(e => /pleno|plenaria/i.test(e.texto)).slice(0, 1), ...pdfs.filter(e => /^Acta de la Comisi[oó]n de fecha/i.test(e.texto)).slice(0, 2)];
    for (const e of elegidas) {
      decir(`\n=== LECTURA: ${e.texto}  ${e.href}`);
      const t = await textoPdf(page, e.href);
      if (!t) { decir('  no se pudo bajar'); continue; }
      decir(`  ${t.length} caracteres. Inicio: ${t.slice(0, 400)}`);
      votaciones(t);
    }
  }

  await navegador.close();
  await writeFile(join(COPIAS, 'sondeo.txt'), salida.join('\n'));
  console.log(`\nFIN. Pega toda la salida. También queda en ${join(COPIAS, 'sondeo.txt')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
