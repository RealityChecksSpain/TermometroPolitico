import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { refrescarCaches } from '../src/lib/metricas';
import { traerTodo } from '../src/lib/paginar';
import { pedir, pedirHtml, lineasPdf, leerIniciativa, elegirTextos, textoDeExpediente, urlIniciativa } from '../src/lib/andalucia';

const argv = process.argv.slice(2);
const SIMULAR = argv.includes('--simular');
const RELEER = argv.includes('--releer');
if (!SIMULAR) exigirEnv('SUPABASE_URL');
const LIMITE = (() => {
  const i = argv.indexOf('--limite');
  const n = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
})();

const CAMARA = 'parlamento-andalucia';
const ACTUAL = 13;
const CARPETA = join(homedir(), 'andalucia-sondeo');
const pausa = (ms = 600) => new Promise(r => setTimeout(r, ms));

async function bajarPdf(url: string): Promise<Uint8Array> {
  const id = url.match(/[?&]id=(\d+)/)?.[1] ?? url.replace(/[^a-z0-9]+/gi, '_').slice(-60);
  const tipo = url.match(/tipodoc=([a-z]+)/i)?.[1] ?? 'doc';
  const ruta = join(CARPETA, 'pdf', `${tipo}-${id}.pdf`);
  if (existsSync(ruta)) return new Uint8Array(await readFile(ruta));
  const r = await pedir(url);
  const buf = new Uint8Array(await r.arrayBuffer());
  await writeFile(ruta, buf);
  await pausa();
  return buf;
}

const lineasCache = new Map<string, string[]>();
async function lineasDe(url: string): Promise<string[]> {
  if (!lineasCache.has(url)) {
    if (lineasCache.size > 20) lineasCache.delete(lineasCache.keys().next().value!);
    lineasCache.set(url, await lineasPdf(await bajarPdf(url)));
  }
  return lineasCache.get(url)!;
}

function completar(expediente: string, legislatura: number): string {
  return legislatura >= 10 ? expediente.replace(new RegExp(`^${String(legislatura).slice(-1)}-(\\d{2}/)`), `${legislatura}-$1`) : expediente;
}

async function expedientesVotados(): Promise<{ expediente: string; legislatura: number }[]> {
  if (SIMULAR) {
    const ruta = join(CARPETA, 'simulacion', 'parl_votaciones.json');
    const filas = existsSync(ruta) ? JSON.parse(await readFile(ruta, 'utf8')) : [];
    const m = new Map<string, number>();
    for (const v of filas) if (v.expediente) m.set(completar(v.expediente, v.legislatura), v.legislatura);
    return [...m].map(([expediente, legislatura]) => ({ expediente, legislatura }));
  }
  const filas = await traerTodo<any>((a, b) => db().from('parl_votaciones')
    .select('expediente, legislatura').eq('camara', CAMARA).not('expediente', 'is', null).order('id').range(a, b));
  const m = new Map<string, number>();
  for (const v of filas) m.set(completar(v.expediente, v.legislatura), v.legislatura);
  return [...m].map(([expediente, legislatura]) => ({ expediente, legislatura }));
}

async function yaLeidas(): Promise<Map<string, any>> {
  if (SIMULAR) return new Map();
  const filas = await traerTodo<any>((a, b) => db().from('parl_iniciativas')
    .select('expediente, legislatura, texto_clase').eq('camara', CAMARA).order('expediente').range(a, b));
  return new Map(filas.map((f: any) => [f.expediente, f]));
}

async function guardar(filas: any[]) {
  if (!filas.length) return;
  if (SIMULAR) {
    await mkdir(join(CARPETA, 'simulacion'), { recursive: true });
    const ruta = join(CARPETA, 'simulacion', 'parl_iniciativas.json');
    const previas = existsSync(ruta) ? JSON.parse(await readFile(ruta, 'utf8')) : [];
    const porExp = new Map(previas.map((f: any) => [f.expediente, f]));
    for (const f of filas) porExp.set(f.expediente, f);
    await writeFile(ruta, JSON.stringify([...porExp.values()]));
    return;
  }
  const { error } = await db().from('parl_iniciativas').upsert(filas, { onConflict: 'camara,expediente' });
  if (error) throw new Error(`parl_iniciativas: ${error.message}`);
}

async function main() {
  console.log(`\nINICIATIVAS DEL PARLAMENTO DE ANDALUCÍA  ${new Date().toISOString()}\n`);
  await mkdir(join(CARPETA, 'pdf'), { recursive: true });
  const todas = await expedientesVotados();
  const previas = await yaLeidas();
  const pendientes = todas
    .filter(x => RELEER || x.legislatura === ACTUAL || !previas.has(x.expediente))
    .sort((a, b) => b.legislatura - a.legislatura || a.expediente.localeCompare(b.expediente));
  const tanda = LIMITE ? pendientes.slice(0, LIMITE) : pendientes;
  console.log(`Expedientes con votación: ${todas.length} · ya leídos: ${previas.size} · a leer ahora: ${tanda.length}${LIMITE ? ` (de ${pendientes.length})` : ''}`);

  const cuenta = { leidas: 0, sinFicha: 0, conTexto: 0, sinTexto: 0, ley: 0, aprobado: 0, presentado: 0 };
  const sinTexto: string[] = [];
  let lote: any[] = [];
  for (const [n, x] of tanda.entries()) {
    const url = urlIniciativa(x.expediente);
    let ini = null;
    try { ini = leerIniciativa(await pedirHtml(url), x.expediente); } catch (e) { console.error(`  ${x.expediente}: ${(e as Error).message}`); }
    await pausa();
    if (!ini) { cuenta.sinFicha++; continue; }
    cuenta.leidas++;
    let elegido: { url: string; fuente: string; clase: string; texto: string } | null = null;
    for (const t of elegirTextos(ini.tramites)) {
      try {
        const texto = textoDeExpediente(await lineasDe(t.url), x.expediente);
        if (texto) { elegido = { ...t, texto }; break; }
      } catch (e) { console.error(`  ${x.expediente} ${t.fuente}: ${(e as Error).message}`); }
    }
    if (elegido) { cuenta.conTexto++; (cuenta as any)[elegido.clase]++; } else { cuenta.sinTexto++; sinTexto.push(`${x.expediente} (${ini.tipo})`); }
    lote.push({
      camara: CAMARA,
      legislatura: ini.legislatura || x.legislatura,
      expediente: x.expediente,
      tipo: ini.tipo,
      tipo_nombre: ini.tipo_nombre,
      proponente: ini.proponente,
      extracto: ini.extracto,
      procedimiento: ini.procedimiento,
      estado: ini.estado,
      fecha_creacion: ini.fecha_creacion,
      comision: ini.comision,
      materias_parlamento: ini.materias_parlamento,
      tramites: ini.tramites,
      url_ficha: url,
      texto_url: elegido?.url ?? null,
      texto_fuente: elegido?.fuente ?? null,
      texto_clase: elegido?.clase ?? null,
      texto_extraido: elegido?.texto ?? null,
      texto_chars: elegido?.texto.length ?? 0,
      leido_at: new Date().toISOString()
    });
    if (lote.length >= 25) { await guardar(lote); lote = []; }
    if ((n + 1) % 25 === 0) console.log(`  ${n + 1}/${tanda.length}`);
  }
  await guardar(lote);

  console.log('\nRESULTADO');
  console.log(`  fichas leídas:        ${cuenta.leidas}${cuenta.sinFicha ? ` (sin ficha: ${cuenta.sinFicha})` : ''}`);
  console.log(`  con texto:            ${cuenta.conTexto} · ley publicada ${cuenta.ley} · texto aprobado ${cuenta.aprobado} · texto presentado ${cuenta.presentado}`);
  console.log(`  sin texto en el BOPA: ${cuenta.sinTexto}${sinTexto.length ? `\n    ${sinTexto.slice(0, 15).join('\n    ')}${sinTexto.length > 15 ? `\n    … y ${sinTexto.length - 15} más` : ''}` : ''}`);
  if (SIMULAR) console.log(`\n[simulación] copia en ${join(CARPETA, 'simulacion', 'parl_iniciativas.json')}`);
  else await refrescarCaches();
  console.log('\nSiguiente: npm run andalucia:resumir -- --limite 10\n');
}

main().catch(e => {
  console.error(`\nERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
