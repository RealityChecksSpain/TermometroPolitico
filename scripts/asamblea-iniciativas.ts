import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { abrirNavegador, cargar } from '../src/lib/navegador';
import { leerCsv, fechaIso, legislaturaDe } from '../src/lib/asamblea-csv';

exigirEnv('SUPABASE_URL');

const BASE = 'https://www.asambleamadrid.es';
const LEGISLATURA = 13;
const CSV_EXPEDIENTES = `${BASE}/static/doc/opendata/ARCHIVO.F_PRINCIPALES_OPENDATA_VIEW.csv`;
const CSV_AUTORES = `${BASE}/static/doc/opendata/ARCHIVO.OPENDATA_MAP_IPS_GP_LEG.csv`;
const COPIAS = resolve(process.argv.find(a => a.startsWith('--copias='))?.slice(9) ?? '../asamblea-sondeo');
const OCULTO = process.argv.includes('--oculto');

function claveDe(f: Record<string, string>): string | null {
  const reg = Number(f.EXP_REG), ano = Number(f.EXP_ANO);
  if (!f.SIGLAS || !Number.isFinite(reg) || !Number.isFinite(ano)) return null;
  return `${f.SIGLAS.trim()}-${reg}/${ano}`;
}

function contar<T>(lista: T[], k: (x: T) => string) {
  const m = new Map<string, number>();
  for (const x of lista) m.set(k(x), (m.get(k(x)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

async function subir(tabla: string, filas: object[], conflicto: string) {
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await db().from(tabla).upsert(filas.slice(i, i + 500), { onConflict: conflicto });
    if (error) throw new Error(`${tabla}: ${error.message}`);
  }
}

async function main() {
  await mkdir(COPIAS, { recursive: true });
  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  if (!(await cargar(page, `${BASE}/servicios/datos-abiertos`))) throw new Error('No carga la página de datos abiertos');
  const bajar = async (url: string) => {
    const res = await page.context().request.get(url, { timeout: 300000 });
    if (!res.ok()) throw new Error(`${url} devolvió ${res.status()}`);
    const texto = (await res.body()).toString('utf8');
    await writeFile(join(COPIAS, url.split('/').pop()!), texto);
    return leerCsv(texto);
  };

  const expedientes = (await bajar(CSV_EXPEDIENTES)).filter(f => legislaturaDe(f.LEGISLATURA) === LEGISLATURA);
  const autores = (await bajar(CSV_AUTORES)).filter(f => legislaturaDe(f.LEGISLATURA) === LEGISLATURA);
  await navegador.close();

  const porClave = new Map<string, object>();
  for (const f of expedientes) {
    const clave = claveDe(f);
    if (!clave) continue;
    porClave.set(clave, {
      clave,
      legislatura: LEGISLATURA,
      siglas: f.SIGLAS.trim(),
      tipo: f.DESCRIPCION || null,
      exp_reg: Number(f.EXP_REG),
      exp_ano: Number(f.EXP_ANO),
      num_ley: f.NUM_LEY || null,
      procedimiento: f.PROCEDIMIENTO || null,
      asunto: f.ASUNTO || null,
      organo: f.PLENO_COMIS || null,
      estado: f.STATUS || null,
      resultado: f.RESULTADO_TRAM || null,
      fecha: fechaIso(f.FECHA ?? ''),
      actualizado_at: new Date().toISOString()
    });
  }
  const autoria = new Map<string, object>();
  for (const f of autores) {
    const clave = claveDe(f);
    if (!clave || !f.DESCRIPCION) continue;
    autoria.set(`${clave}|${f.DESCRIPCION}`, { clave, grupo: f.DESCRIPCION.trim(), autor: f.AUTOR || null });
  }

  await subir('asamblea_iniciativas', [...porClave.values()], 'clave');
  await subir('asamblea_iniciativa_autores', [...autoria.values()], 'clave,grupo');

  console.log(`\nLegislatura ${LEGISLATURA}: ${porClave.size} expedientes y ${autoria.size} autorías guardadas`);
  console.log('\nTIPOS (siglas · descripción · n)');
  for (const [k, n] of contar(expedientes, f => `${f.SIGLAS} · ${f.DESCRIPCION}`).slice(0, 40)) console.log(`  ${String(n).padStart(6)}  ${k}`);
  console.log('\nSTATUS');
  for (const [k, n] of contar(expedientes, f => f.STATUS || '(vacío)').slice(0, 25)) console.log(`  ${String(n).padStart(6)}  ${k}`);
  console.log('\nRESULTADO_TRAM');
  for (const [k, n] of contar(expedientes, f => f.RESULTADO_TRAM || '(vacío)').slice(0, 25)) console.log(`  ${String(n).padStart(6)}  ${k}`);
  console.log('\nPLENO_COMIS');
  for (const [k, n] of contar(expedientes, f => f.PLENO_COMIS || '(vacío)').slice(0, 10)) console.log(`  ${String(n).padStart(6)}  ${k}`);
  console.log('\nAUTORÍA (grupo · n)');
  for (const [k, n] of contar(autores, f => `${f.DESCRIPCION} (${f.AUTOR})`).slice(0, 20)) console.log(`  ${String(n).padStart(6)}  ${k}`);
  const conAutor = new Set([...autoria.values()].map((a: any) => a.clave));
  const sinAutor = [...porClave.keys()].filter(c => !conAutor.has(c)).length;
  console.log(`\nExpedientes sin grupo autor: ${sinAutor} de ${porClave.size}`);
  console.log('\nMUESTRA');
  for (const f of expedientes.filter(f => /^(PL|PROPL|PNL)$/.test(f.SIGLAS)).slice(0, 6)) {
    console.log(`  ${f.SIGLAS} ${f.EXP_REG}/${f.EXP_ANO} · ${f.STATUS} · ${f.RESULTADO_TRAM} · ${f.FECHA} · ${(f.ASUNTO ?? '').slice(0, 120)}`);
  }
  console.log('\nFIN. Pega toda la salida.');
}

main().catch(e => { console.error(e); process.exit(1); });
