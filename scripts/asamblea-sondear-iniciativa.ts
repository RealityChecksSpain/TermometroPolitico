import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { abrirNavegador, cargar, enlaces, lineas, esperar } from '../src/lib/navegador';

exigirEnv('SUPABASE_URL');

const BASE = 'https://www.asambleamadrid.es';
const COPIAS = resolve(process.argv.find(a => a.startsWith('--copias='))?.slice(9) ?? '../asamblea-sondeo');
const OCULTO = process.argv.includes('--oculto');

async function una(siglas: string, resultado: string | null) {
  let q = db().from('asamblea_iniciativas').select('clave, estado, resultado, asunto').eq('legislatura', 13).eq('siglas', siglas).order('fecha', { ascending: false }).limit(40);
  if (resultado) q = q.ilike('resultado', `%${resultado}%`);
  const { data: inis, error } = await q;
  if (error) throw error;
  const claves = (inis ?? []).map((i: any) => i.clave);
  if (!claves.length) return null;
  const { data: web, error: e2 } = await db().from('asamblea_iniciativa_web').select('clave, id_web').in('clave', claves).limit(1);
  if (e2) throw e2;
  const w = web?.[0];
  return w ? { ...w, asamblea_iniciativas: (inis ?? []).find((i: any) => i.clave === w.clave) } : null;
}

async function main() {
  await mkdir(join(COPIAS, 'iniciativas'), { recursive: true });
  const muestras = [await una('PL', 'aprob'), await una('PROPL', null), await una('PNL', 'aprob'), await una('PNL', 'rechaz')].filter(Boolean) as any[];
  if (!muestras.length) throw new Error('No hay iniciativas con página web guardada. Corre antes npm run asamblea:enlaces');
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  for (const m of muestras) {
    const url = `${BASE}/actividad/iniciativa?iniciativa=${m.id_web}`;
    console.log(`\n==================== ${m.clave} · ${m.asamblea_iniciativas.resultado ?? m.asamblea_iniciativas.estado ?? ''}`);
    console.log(url);
    if (!(await cargar(page, url))) { console.log('  no carga'); continue; }
    await esperar(2500);
    await writeFile(join(COPIAS, 'iniciativas', `${m.clave.replace(/[^A-Za-z0-9]+/g, '_')}.html`), await page.content());
    const ls = await lineas(page);
    const desde = Math.max(0, ls.findIndex(l => l.includes(m.clave.split('-')[1]?.split('/')[0] ?? '###')) - 3);
    console.log('--- TEXTO DE LA PÁGINA');
    console.log(ls.slice(desde, desde + 70).join('\n'));
    console.log('--- ENLACES A DOCUMENTOS');
    for (const e of await enlaces(page)) {
      if (/pdf|boam|dsam|static\/doc|documento|diario|bolet/i.test(`${e.href} ${e.texto}`)) console.log(`  ${e.texto.slice(0, 80)} -> ${e.href}`);
    }
  }
  await navegador.close();
  console.log(`\nCopias HTML en ${join(COPIAS, 'iniciativas')}\n`);
}

main().catch(e => {
  console.error(`\nERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
