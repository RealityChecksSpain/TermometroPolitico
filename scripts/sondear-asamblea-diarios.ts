import { mkdir, writeFile } from 'node:fs/promises';
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

const INTERES = /diario|sesi[oó]n|publicaci|boletin|boam|iniciativa|expediente|buscador|votaci|pleno|tramitaci/i;

async function recorrer(page: Page, url: string) {
  if (!(await cargar(page, url))) { decir(`  no carga ${url}`); return []; }
  const ls = (await enlaces(page)).filter(e => e.href.startsWith(BASE) && !e.href.endsWith('#'));
  const formularios = await page.$$eval('form', fs => fs.map(f => ({
    accion: (f as HTMLFormElement).action,
    metodo: (f as HTMLFormElement).method,
    campos: [...f.querySelectorAll('input,select')].map(i => `${(i as HTMLInputElement).name}=${(i as HTMLInputElement).type ?? i.tagName}`).join(' ')
  })));
  decir(`\n=== ${url}  (${await page.title()})`);
  for (const f of formularios) decir(`  formulario ${f.metodo} ${f.accion} · ${f.campos}`);
  await esperar(PAUSA_MS);
  return ls;
}

async function main() {
  await mkdir(COPIAS, { recursive: true });
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();

  const vistos = new Map<string, string>();
  for (const url of [BASE, `${BASE}/actividad`, `${BASE}/publicaciones`, `${BASE}/servicios/datos-abiertos`]) {
    for (const e of await recorrer(page, url)) if (!vistos.has(e.href)) vistos.set(e.href, e.texto);
  }

  decir('\n=== ENLACES DE INTERÉS');
  const interesantes = [...vistos].filter(([h, t]) => INTERES.test(h) || INTERES.test(t));
  for (const [h, t] of interesantes.slice(0, 80)) decir(`  ${t.slice(0, 70).padEnd(70)}  ${h}`);

  decir('\n=== DATOS ABIERTOS: TODOS LOS FICHEROS');
  for (const [h, t] of [...vistos].filter(([h]) => /\.(csv|json|xml|xlsx?)(\?|$)/i.test(h))) decir(`  ${t.slice(0, 60).padEnd(60)}  ${h}`);

  const paginasDiario = interesantes.filter(([h, t]) => /diario/i.test(h) || /diario de sesiones/i.test(t)).slice(0, 3);
  const pdfs: { url: string; texto: string }[] = [];
  for (const [h] of paginasDiario) {
    for (const e of await recorrer(page, h)) {
      if (/\.pdf(\?|$)/i.test(e.href) && !pdfs.some(p => p.url === e.href)) pdfs.push({ url: e.href, texto: e.texto });
    }
  }
  decir(`\n=== PDF ENCONTRADOS EN LAS PÁGINAS DE DIARIOS: ${pdfs.length}`);
  for (const p of pdfs.slice(0, 25)) decir(`  ${p.texto.slice(0, 70).padEnd(70)}  ${p.url}`);

  const pleno = pdfs.filter(p => /pleno/i.test(p.texto) || /pleno|ds_?p|dsp/i.test(p.url)).slice(0, 2);
  for (const p of (pleno.length ? pleno : pdfs.slice(0, 2))) {
    decir(`\n=== LECTURA DE ${p.url}`);
    const buf = await bajarPdf(page, p.url);
    await esperar(PAUSA_MS);
    if (!buf) { decir('  no se pudo bajar'); continue; }
    await writeFile(join(COPIAS, p.url.split('/').pop()!.split('?')[0]), buf);
    const { totalPages, text } = await extractText(await getDocumentProxy(new Uint8Array(buf)), { mergePages: true });
    const t = String(text).replace(/\s+/g, ' ');
    decir(`  ${totalPages} páginas, ${t.length} caracteres`);
    const re = /(resultado de la votaci[oó]n|votos a favor|queda (aprobad|rechazad)|votaci[oó]n separada|con los votos)/gi;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(t)) && n < 12) {
      decir(`  … ${t.slice(Math.max(0, m.index - 300), m.index + 400)} …`);
      n++;
    }
    if (!n) decir('  no aparece ninguna fórmula de votación en el texto');
  }

  await navegador.close();
  await writeFile(join(COPIAS, 'sondeo.txt'), salida.join('\n'));
  console.log(`\nFIN. Pega toda la salida. También queda en ${join(COPIAS, 'sondeo.txt')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
