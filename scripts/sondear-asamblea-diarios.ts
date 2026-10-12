import { mkdir, writeFile } from 'node:fs/promises';
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

async function bajarCsv(page: Page, nombre: string) {
  const res = await page.context().request.get(`${OPENDATA}/${nombre}`, { timeout: 300000 });
  if (!res.ok()) { decir(`  ${nombre} devolvió ${res.status()}`); return []; }
  const texto = (await res.body()).toString('utf8');
  await writeFile(join(COPIAS, nombre), texto);
  await esperar(PAUSA_MS);
  return leerCsv(texto);
}

function describir(nombre: string, filas: Record<string, string>[]) {
  decir(`\n=== ${nombre}: ${filas.length} filas`);
  if (!filas.length) return;
  decir(`  columnas: ${Object.keys(filas[0]).join(', ')}`);
  for (const f of filas.slice(-3)) decir(`  ${JSON.stringify(f).slice(0, 600)}`);
}

function urlDe(f: Record<string, string>): string | null {
  for (const v of Object.values(f)) {
    if (/^https?:\/\//i.test(v)) return v;
    if (/\.pdf$/i.test(v)) return v.startsWith('/') ? `${BASE}${v}` : `${BASE}/${v}`;
  }
  return null;
}

async function leerVotaciones(page: Page, url: string) {
  decir(`\n=== LECTURA DE ${url}`);
  const buf = await bajarPdf(page, url);
  await esperar(PAUSA_MS);
  if (!buf) { decir('  no se pudo bajar como PDF'); return; }
  await writeFile(join(COPIAS, url.split('/').pop()!.split('?')[0] || 'diario.pdf'), buf);
  const { totalPages, text } = await extractText(await getDocumentProxy(new Uint8Array(buf)), { mergePages: true });
  const t = String(text).replace(/\s+/g, ' ');
  decir(`  ${totalPages} páginas, ${t.length} caracteres`);
  const re = /(resultado de la votaci[oó]n|votos a favor|queda(n)? (aprobad|rechazad)|con los votos|se procede a la votaci[oó]n)/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(t)) && n < 10) {
    decir(`  … ${t.slice(Math.max(0, m.index - 250), m.index + 450)} …`);
    re.lastIndex = m.index + 450;
    n++;
  }
  if (!n) decir('  no aparece ninguna fórmula de votación en el texto');
}

async function pagina(page: Page, url: string) {
  if (!(await cargar(page, url))) { decir(`  no carga ${url}`); return; }
  decir(`\n=== ${url}  (${await page.title()})`);
  const formularios = await page.$$eval('form', fs => fs.map(f => ({
    accion: (f as HTMLFormElement).action,
    campos: [...f.querySelectorAll('input,select')].map(i => (i as HTMLInputElement).name.replace(/^_es_satec_liferay_[^_]+(_INSTANCE_[A-Za-z0-9]+)?_/, '')).filter(Boolean).join(' ')
  })));
  for (const f of formularios.filter(f => !/update_language|busqueda$|#$/.test(f.accion))) decir(`  formulario ${f.accion.slice(0, 160)} · ${f.campos.slice(0, 300)}`);
  const ls = await lineas(page);
  decir(`  texto: ${ls.slice(0, 120).join(' | ').slice(0, 1500)}`);
  const es = (await enlaces(page)).filter(e => e.href.startsWith(BASE) && /expediente|iniciativa|detalle|ficha|votaci|\.pdf/i.test(e.href)).slice(0, 25);
  for (const e of es) decir(`  ${e.texto.slice(0, 60).padEnd(60)}  ${e.href}`);
  await esperar(PAUSA_MS);
}

async function main() {
  await mkdir(COPIAS, { recursive: true });
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  if (!(await cargar(page, `${BASE}/servicios/datos-abiertos`))) throw new Error('No carga la página de datos abiertos');
  await esperar(PAUSA_MS);

  const dsam = await bajarCsv(page, 'SGP_ADMIN.OPENDATA_DSAM_VIEW.csv');
  describir('DIARIOS DE SESIONES', dsam);
  const boam = await bajarCsv(page, 'SGP_ADMIN.OPENDATA_BOAM_VIEW.csv');
  describir('BOLETINES OFICIALES', boam);
  const reuniones = await bajarCsv(page, 'SGP_ADMIN.REUNIONES_TODAS.csv');
  describir('REUNIONES', reuniones);

  const col = (f: Record<string, string>, re: RegExp) => Object.entries(f).find(([k]) => re.test(k))?.[1] ?? '';
  const ds13 = dsam.filter(f => legislaturaDe(col(f, /legis/i)) === 13);
  decir(`\nDiarios de la XIII legislatura: ${ds13.length}`);
  const plenos = ds13.filter(f => /pleno/i.test(Object.values(f).join(' ')) && urlDe(f));
  decir(`  de Pleno con enlace: ${plenos.length}`);
  for (const f of plenos.slice(-2)) await leerVotaciones(page, urlDe(f)!);
  if (!plenos.length && ds13.length && urlDe(ds13[ds13.length - 1])) await leerVotaciones(page, urlDe(ds13[ds13.length - 1])!);

  await pagina(page, `${BASE}/actividad/iniciativas`);
  await pagina(page, `${BASE}/actividad/sesiones`);

  await navegador.close();
  await writeFile(join(COPIAS, 'sondeo.txt'), salida.join('\n'));
  console.log(`\nFIN. Pega toda la salida. También queda en ${join(COPIAS, 'sondeo.txt')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
