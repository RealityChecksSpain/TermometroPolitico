import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Page } from 'playwright-core';
import { extractText, getDocumentProxy } from 'unpdf';
import { abrirNavegador, bajarPdf, cargar, enlaces, esperar } from '../src/lib/navegador';

const BASE = 'https://www.asambleamadrid.es';
const PAUSA_MS = 3500;
const COPIAS = resolve(process.argv.find(a => a.startsWith('--copias='))?.slice(9) ?? '../asamblea-sondeo/diarios');
const OCULTO = process.argv.includes('--oculto');
const salida: string[] = [];

function decir(t = '') {
  console.log(t);
  salida.push(t);
}

async function texto(buf: Buffer) {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(buf)), { mergePages: true });
  return String(text).replace(/\s+/g, ' ');
}

function trozos(t: string, re: RegExp, max: number, antes = 300, despues = 500) {
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(t)) && n < max) {
    decir(`  … ${t.slice(Math.max(0, m.index - antes), m.index + despues)} …`);
    re.lastIndex = m.index + despues;
    n++;
  }
  if (!n) decir(`  nada con ${re}`);
}

async function main() {
  await mkdir(COPIAS, { recursive: true });
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  if (!(await cargar(page, `${BASE}/servicios/publicaciones/ddss`))) throw new Error('No carga la página de Diarios de Sesiones');
  await esperar(PAUSA_MS);

  decir('\n=== PÁGINA DE DIARIOS DE SESIONES');
  for (const e of (await enlaces(page)).filter(e => /\.pdf/i.test(e.href)).slice(0, 8)) decir(`  ${e.texto.slice(0, 70).padEnd(70)}  ${e.href}`);

  for (const url of [`${BASE}/static/doc/publicaciones/XIII-DS-829.pdf`, `${BASE}/static/doc/publicaciones/DS_13_00829.pdf`]) {
    decir(`\n=== PRUEBA ${url}`);
    const buf = await bajarPdf(page, url);
    await esperar(PAUSA_MS);
    if (!buf) { decir('  no existe o no es PDF'); continue; }
    await writeFile(join(COPIAS, url.split('/').pop()!), buf);
    const t = await texto(buf);
    decir(`  ${t.length} caracteres. Inicio: ${t.slice(0, 300)}`);
    trozos(t, /(resultado de la votaci[oó]n|votos a favor|votaci[oó]n separada|se procede a votar|procedemos a votar)/gi, 6);
    break;
  }

  decir('\n=== ACTA DE COMISIÓN: TODO LO QUE MENCIONA VOTAR');
  try {
    const t = await texto(await readFile(join(COPIAS, 'DOC1932041.pdf')));
    trozos(t, /vot|aprob|rechaz/gi, 8, 200, 400);
  } catch (e) {
    decir(`  no está la copia: ${(e as Error).message}`);
  }

  if (await cargar(page, `${BASE}/actividad/iniciativas`)) {
    decir('\n=== BUSCADOR DE INICIATIVAS: CAMPOS Y OPCIONES');
    const campos = await page.$$eval('form select, form input[type=text]', els => els.map(el => ({
      nombre: (el as HTMLInputElement).name,
      opciones: el.tagName === 'SELECT' ? [...(el as HTMLSelectElement).options].map(o => `${o.value}=${o.text.trim()}`).slice(0, 80) : []
    })));
    for (const c of campos) decir(`  ${c.nombre.replace(/^_es_satec_liferay_asamblea_BuscadorIniciativasPortlet_INSTANCE_[A-Za-z0-9]+_/, '')}: ${c.opciones.join(' | ').slice(0, 1800)}`);
  }

  await navegador.close();
  await writeFile(join(COPIAS, 'sondeo.txt'), salida.join('\n'));
  console.log(`\nFIN. Pega toda la salida. También queda en ${join(COPIAS, 'sondeo.txt')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
