import type { Page } from 'playwright-core';
import { db, exigirEnv } from '../src/lib/supabase';
import { abrirNavegador, cargar, enlaces, esperar, lineas } from '../src/lib/navegador';

exigirEnv('SUPABASE_URL');

const BASE = 'https://www.asambleamadrid.es';
const BUSCADOR = `${BASE}/actividad/iniciativas`;
const PAUSA_MS = 3500;
const TIPOS = ['PL', 'PROPL', 'PNL'];
const argv = process.argv.slice(2);
const OCULTO = argv.includes('--oculto');
const SIN_FIRMANTES = argv.includes('--sin-firmantes');
const LIMITE = Number(argv.find(a => a.startsWith('--limite='))?.slice(9) ?? Infinity);

type Hallado = { clave: string; id_web: number };

function claveDe(texto: string): string | null {
  const m = texto.match(/^([A-Z/]+)-(\d+)\/(\d{4})\s*\(XIII\)/);
  return m ? `${m[1]}-${Number(m[2])}/${m[3]}` : null;
}

async function resultados(page: Page): Promise<{ hallados: Hallado[]; siguiente: string | null }> {
  const es = await enlaces(page);
  const hallados: Hallado[] = [];
  for (const e of es) {
    const id = e.href.match(/\/actividad\/iniciativa\?iniciativa=(\d+)/)?.[1];
    const clave = claveDe(e.texto);
    if (id && clave) hallados.push({ clave, id_web: Number(id) });
  }
  const sig = es.find(e => /^siguiente$/i.test(e.texto) && !e.href.endsWith('#'));
  return { hallados, siguiente: sig?.href ?? null };
}

async function fijar(page: Page, sufijo: string, valor: string): Promise<boolean> {
  const cambiado = await page.evaluate(([suf, val]) => {
    const el = [...document.querySelectorAll('select')].find(s => s.name.endsWith(suf)) as HTMLSelectElement | undefined;
    if (!el) return false;
    if (el.value === val) return true;
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [sufijo, valor]);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await esperar(PAUSA_MS);
  return cambiado;
}

async function valorDe(page: Page, sufijo: string) {
  return page.evaluate(suf => ([...document.querySelectorAll('select')].find(s => s.name.endsWith(suf)) as HTMLSelectElement | undefined)?.value ?? null, sufijo);
}

async function buscarTipo(page: Page, tipo: string): Promise<Hallado[]> {
  if (!(await cargar(page, BUSCADOR))) throw new Error('No carga el buscador de iniciativas');
  await esperar(PAUSA_MS);
  if ((await valorDe(page, '_legislatura')) !== '13') await fijar(page, '_legislatura', '13');
  await fijar(page, '_tipo', tipo);
  console.log(`  ${tipo}: legislatura ${await valorDe(page, '_legislatura')}, tipo ${await valorDe(page, '_tipo')}`);
  const boton = page.locator('form:has(select[name$="_tipo"])').locator('button:visible, input[type=submit]:visible').filter({ hasText: /buscar/i }).first();
  const botones = await page.locator('form:has(select[name$="_tipo"])').locator('button:visible, input[type=submit]:visible').allInnerTexts().catch(() => []);
  console.log(`  botones del formulario: ${botones.map(b => b.trim()).filter(Boolean).join(' | ') || '(ninguno visible)'}`);
  if (await boton.count()) {
    await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), boton.click()]);
  } else {
    await page.evaluate(() => {
      const f = ([...document.querySelectorAll('select')].find(s => s.name.endsWith('_tipo')) as HTMLSelectElement | undefined)?.form;
      if (f) (f.requestSubmit ? f.requestSubmit() : f.submit());
    });
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await esperar(PAUSA_MS);
  const muestra = (await resultados(page)).hallados.slice(0, 3).map(h => h.clave).join(', ');
  console.log(`  primeros resultados: ${muestra || '(ninguno)'}`);
  const sig = (await enlaces(page)).find(e => /^siguiente$/i.test(e.texto) && !e.href.endsWith('#'));
  if (sig) console.log(`  parámetros de la página 2: ${decodeURIComponent(sig.href.split('FormValues=')[1] ?? '').slice(0, 400)}`);

  const todos = new Map<string, Hallado>();
  let pagina = 1;
  while (true) {
    const { hallados, siguiente } = await resultados(page);
    const ajenos = hallados.filter(h => !h.clave.startsWith(`${tipo}-`));
    if (pagina === 1 && (ajenos.length || !hallados.length)) {
      console.log(`  ${tipo}: el filtro no ha funcionado (${hallados.length} resultados, ${ajenos.length} de otro tipo). Paro este tipo.`);
      return [];
    }
    const antes = todos.size;
    for (const h of hallados) if (h.clave.startsWith(`${tipo}-`)) todos.set(h.clave, h);
    process.stdout.write(`\r  ${tipo}: página ${pagina}, ${todos.size} iniciativas`);
    if (!siguiente || todos.size === antes || todos.size >= LIMITE) break;
    await esperar(PAUSA_MS);
    if (!(await cargar(page, siguiente))) break;
    pagina++;
  }
  console.log('');
  return [...todos.values()];
}

async function firmantes(page: Page, id: number): Promise<string | null> {
  if (!(await cargar(page, `${BASE}/actividad/iniciativa?iniciativa=${id}`))) return null;
  const ls = await lineas(page);
  const i = ls.findIndex(l => /^Autores?$/i.test(l));
  if (i < 0) return '';
  const fin = ls.findIndex((l, k) => k > i && /^(Destinatario|Tramitaci[oó]n|Comisi[oó]n|Ponencia|Enmiendas)$/i.test(l));
  return ls.slice(i + 1, fin > i ? fin : i + 1).join('; ');
}

async function main() {
  console.log(`\nENLACES DE INICIATIVAS DE LA ASAMBLEA  ${new Date().toISOString()}\n`);
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();

  const { data: conocidas, error } = await db().from('asamblea_iniciativas').select('clave').eq('legislatura', 13).in('siglas', TIPOS);
  if (error) throw error;
  const enBase = new Set((conocidas ?? []).map(c => c.clave));

  for (const tipo of TIPOS) {
    const hallados = await buscarTipo(page, tipo);
    const validos = hallados.filter(h => enBase.has(h.clave));
    const fuera = hallados.filter(h => !enBase.has(h.clave));
    if (validos.length) {
      const { error: e } = await db().from('asamblea_iniciativa_web').upsert(validos.map(v => ({ ...v, leido_at: new Date().toISOString() })), { onConflict: 'clave', ignoreDuplicates: false });
      if (e) throw e;
    }
    console.log(`  ${tipo}: ${validos.length} guardadas${fuera.length ? `, ${fuera.length} sin pareja en los datos abiertos (${fuera.slice(0, 5).map(f => f.clave).join(', ')})` : ''}`);
  }

  if (!SIN_FIRMANTES) {
    const { data: pendientes, error: e } = await db().from('asamblea_iniciativa_web').select('clave, id_web').is('firmantes', null).order('clave');
    if (e) throw e;
    const lista = (pendientes ?? []).slice(0, LIMITE);
    console.log(`\nFirmantes por leer: ${lista.length}. Se puede cortar con Ctrl+C y seguir otro día: solo lee los que faltan.`);
    let n = 0;
    for (const p of lista) {
      const f = await firmantes(page, p.id_web);
      await esperar(PAUSA_MS);
      if (f == null) { console.log(`  ${p.clave}: no carga`); continue; }
      const { error: e2 } = await db().from('asamblea_iniciativa_web').update({ firmantes: f, leido_at: new Date().toISOString() }).eq('clave', p.clave);
      if (e2) console.log(`  ${p.clave}: ${e2.message}`);
      if (++n % 25 === 0 || n <= 5) console.log(`  [${n}/${lista.length}] ${p.clave}: ${f || '(sin autores en la página)'}`);
    }
  }

  await navegador.close();
  const { count } = await db().from('asamblea_iniciativa_web').select('clave', { count: 'exact', head: true });
  const { count: conFirma } = await db().from('asamblea_iniciativa_web').select('clave', { count: 'exact', head: true }).not('firmantes', 'is', null);
  console.log(`\nEn la base: ${count} enlaces, ${conFirma} con firmantes leídos, de ${enBase.size} iniciativas.`);
  console.log('FIN. Pega toda la salida.');
}

main().catch(e => { console.error(e); process.exit(1); });
