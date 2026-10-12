import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { getDocumentProxy, extractText } from 'unpdf';

const avisoOriginal = console.warn;
console.warn = (...a: any[]) => { if (!/glyf|TT:|undefined function/i.test(String(a[0] ?? ''))) avisoOriginal(...a); };

const BASE = 'https://www.asambleamadrid.es';
const SALIDA = resolve(process.argv.find(a => a.startsWith('--salida='))?.slice(9) ?? '../asamblea-sondeo');
const OCULTO = process.argv.includes('--oculto');
const PAUSA_MS = 4000;

const PAGINAS = [
  `${BASE}/diputados`,
  `${BASE}/composicion/diputados/regimen-economico-social/lista-general-bienes`,
  `${BASE}/actividad/leyes-y-resoluciones`,
  `${BASE}/organos/pleno/informacion-pleno`,
  `${BASE}/servicios/datos-abiertos`,
  `${BASE}/transparencia`
];

const CLAVES = /bien|declara|inter[eé]s|actividad|retribu|votaci|voto|diario|sesi[oó]n|pleno|datos.abiertos|opendata|iniciativ|boam|ley|resoluci|\.pdf|\.json|\.csv|\.xml|\.xlsx?|rss|api/i;

interface Enlace { texto: string; href: string }

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

async function abrirNavegador(): Promise<Browser> {
  for (const channel of ['chrome', 'msedge']) {
    try {
      const b = await chromium.launch({ channel, headless: OCULTO });
      console.log(`navegador: ${channel}${OCULTO ? ' (oculto)' : ''}`);
      return b;
    } catch {}
  }
  throw new Error('No encuentro Chrome ni Edge instalados en este equipo');
}

async function cargar(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log(`  no carga: ${(e as Error).message.split('\n')[0]}`);
    return false;
  }
  for (let i = 0; i < 20; i++) {
    const titulo = await page.title().catch(() => '');
    if (!/being redirected/i.test(titulo)) break;
    await esperar(1000);
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const titulo = await page.title().catch(() => '');
  if (/being redirected|access denied|blocked/i.test(titulo)) {
    console.log(`  la pagina sigue bloqueada: ${titulo}`);
    return false;
  }
  return true;
}

async function enlaces(page: Page): Promise<Enlace[]> {
  return page.$$eval('a[href]', as => as.map(a => ({
    texto: (a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    href: (a as HTMLAnchorElement).href
  })));
}

function nombreFichero(url: string, ext: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 120) + ext;
}

async function guardarPagina(page: Page, url: string): Promise<Enlace[]> {
  const html = await page.content();
  const texto = await page.evaluate(() => document.body?.innerText ?? '');
  await writeFile(join(SALIDA, nombreFichero(url, '.html')), html);
  await writeFile(join(SALIDA, nombreFichero(url, '.txt')), texto);
  const lista = await enlaces(page);
  const utiles = lista.filter(e => CLAVES.test(e.href) || CLAVES.test(e.texto));
  console.log(`  titulo: ${await page.title()}`);
  console.log(`  texto ${texto.length} caracteres, enlaces ${lista.length}, interesantes ${utiles.length}`);
  for (const e of utiles.slice(0, 40)) console.log(`    ${e.texto || '(sin texto)'}  ->  ${e.href}`);
  console.log('  primeras lineas:');
  console.log(texto.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 25).map(l => '    ' + l.slice(0, 160)).join('\n'));
  return lista;
}

async function leerPdf(page: Page, url: string, etiqueta: string) {
  console.log(`\n=== PDF ${etiqueta}: ${url}`);
  try {
    const res = await page.context().request.get(url, { timeout: 60000 });
    const tipo = res.headers()['content-type'] ?? '';
    const cuerpo = await res.body();
    console.log(`  estado ${res.status()}  tipo ${tipo}  ${Math.round(cuerpo.length / 1024)} KB`);
    if (!/pdf/i.test(tipo) && cuerpo.subarray(0, 4).toString() !== '%PDF') {
      console.log('  no es un PDF');
      return;
    }
    await writeFile(join(SALIDA, nombreFichero(url, '.pdf')), cuerpo);
    const pdf = await getDocumentProxy(new Uint8Array(cuerpo));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    await writeFile(join(SALIDA, nombreFichero(url, '.pdf.txt')), text);
    console.log(`  paginas ${totalPages}, texto ${text.length} caracteres`);
    const pistas = text.match(/.{0,80}(votaci[oó]n nominal|votos a favor|votos en contra|abstenciones|vot[oó] s[ií]|llamamiento|resultado de la votaci[oó]n).{0,120}/gi) ?? [];
    console.log(`  pistas de votacion: ${pistas.length}`);
    for (const p of pistas.slice(0, 12)) console.log(`    ${p.replace(/\s+/g, ' ')}`);
    console.log('  muestra:');
    console.log(text.replace(/\s+/g, ' ').slice(0, 1500).replace(/(.{150})/g, '    $1\n'));
  } catch (e) {
    console.log(`  fallo: ${(e as Error).message.split('\n')[0]}`);
  }
}

async function main() {
  await mkdir(SALIDA, { recursive: true });
  console.log(`\nSONDEO ASAMBLEA DE MADRID  ${new Date().toISOString()}`);
  console.log(`guardo copias en ${SALIDA}\n`);
  const navegador = await abrirNavegador();
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  const todos: Enlace[] = [];

  for (const url of PAGINAS) {
    console.log(`\n=== ${url}`);
    if (await cargar(page, url)) todos.push(...await guardarPagina(page, url));
    await esperar(PAUSA_MS);
  }

  const unicos = [...new Map(todos.map(e => [e.href, e])).values()].filter(e => e.href.startsWith(BASE));
  const ficha = unicos.find(e => /\/diputados\/[^/?#]+\/?$/i.test(e.href) && !/lista|regimen/i.test(e.href));
  if (ficha) {
    console.log(`\n=== FICHA ${ficha.texto}: ${ficha.href}`);
    if (await cargar(page, ficha.href)) await guardarPagina(page, ficha.href);
    await esperar(PAUSA_MS);
  } else console.log('\n=== FICHA: no encuentro enlace con pinta de ficha de diputado');

  const pdfs = unicos.filter(e => /\.pdf(\?|$)/i.test(e.href));
  console.log(`\n=== ${pdfs.length} PDF enlazados en total`);
  const bienes = pdfs.find(e => /bien|declara/i.test(e.href + e.texto));
  if (bienes) { await leerPdf(page, bienes.href, 'declaracion de bienes'); await esperar(PAUSA_MS); }

  const diarios = unicos.filter(e => /diario|dsam|sesi[oó]n/i.test(e.href + e.texto));
  console.log(`\n=== enlaces a diarios o sesiones: ${diarios.length}`);
  for (const d of diarios.slice(0, 15)) console.log(`    ${d.texto}  ->  ${d.href}`);
  const diarioPdf = diarios.find(e => /\.pdf(\?|$)/i.test(e.href)) ?? pdfs.find(e => /diario|dsam/i.test(e.href + e.texto));
  if (diarioPdf) await leerPdf(page, diarioPdf.href, 'diario de sesiones');
  else if (diarios[0]) {
    console.log(`\n=== DIARIO ${diarios[0].href}`);
    if (await cargar(page, diarios[0].href)) {
      const dentro = await guardarPagina(page, diarios[0].href);
      const p = dentro.find(e => /\.pdf(\?|$)/i.test(e.href));
      if (p) { await esperar(PAUSA_MS); await leerPdf(page, p.href, 'diario de sesiones'); }
    }
  }

  await navegador.close();
  console.log('\nFIN. Pega toda esta salida en el chat. Las copias se quedan en la carpeta indicada, fuera del repo.');
}

main().catch(e => { console.error(e); process.exit(1); });
