import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { abrirNavegador, cargar, enlaces, lineas } from '../src/lib/navegador';

exigirEnv('SUPABASE_URL');

const BASE = 'https://www.asambleamadrid.es';
const LEGISLATURA = 13;
const CSV_DIPUTADOS = `${BASE}/static/doc/opendata/OAD.OPENDATA_DIPUTADOS_VIEW.csv`;
const CSV_PLENOS = `${BASE}/static/doc/opendata/SGP_ADMIN.OPENDATA_ASISTENTES_PLENO.csv`;
const COPIAS = resolve(process.argv.find(a => a.startsWith('--copias='))?.slice(9) ?? '../asamblea-sondeo');
const OCULTO = process.argv.includes('--oculto');

function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  const nombres = (cab ?? []).map(c => c.replace(/^﻿/, '').trim());
  return resto.filter(f => f.length > 1).map(f => Object.fromEntries(nombres.map((n, k) => [n, (f[k] ?? '').trim()])));
}

function tokens(nombre: string): string[] {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-zñ\s-]/g, ' ').split(/[\s-]+/).filter(t => t.length > 1);
}

function clave(nombre: string): string {
  return tokens(nombre).sort().join(' ');
}

function desdeApellidosComaNombre(s: string): string {
  const [ap, no] = s.split(',');
  return no ? `${no.trim()} ${ap.trim()}` : s;
}

function fechaIso(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function legislaturaDe(v: string): number | null {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;
  const romanos: Record<string, number> = { I: 1, V: 5, X: 10 };
  const r = v.trim().toUpperCase();
  if (!/^[IVX]+$/.test(r)) return null;
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const a = romanos[r[i]], b = romanos[r[i + 1]] ?? 0;
    total += a < b ? -a : a;
  }
  return total;
}

type Dip = { id: number; nombre: string; tokens: Set<string> };

function cruzar(nombre: string, porClave: Map<string, Dip>, todos: Dip[]): Dip | null {
  const exacto = porClave.get(clave(nombre));
  if (exacto) return exacto;
  const t = new Set(tokens(nombre));
  const candidatos = todos.filter(d => {
    const comunes = [...t].filter(x => d.tokens.has(x)).length;
    return comunes >= 3 && (comunes === t.size || comunes === d.tokens.size);
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

async function main() {
  await mkdir(COPIAS, { recursive: true });
  const { data: dips, error } = await db().from('asamblea_diputados').select('id_asamblea, nombre_completo').eq('legislatura', LEGISLATURA);
  if (error) throw error;
  if (!dips?.length) throw new Error('No hay diputados de la Asamblea cargados. Antes: npm run asamblea');
  const todos: Dip[] = dips.map(d => ({ id: d.id_asamblea, nombre: d.nombre_completo, tokens: new Set(tokens(d.nombre_completo)) }));
  const porClave = new Map(todos.map(d => [clave(d.nombre), d]));

  const navegador = await abrirNavegador(OCULTO);
  const page = await (await navegador.newContext({ locale: 'es-ES' })).newPage();
  if (!(await cargar(page, `${BASE}/servicios/datos-abiertos`))) throw new Error('No carga la página de datos abiertos');

  const bajar = async (url: string) => {
    const res = await page.context().request.get(url, { timeout: 120000 });
    if (!res.ok()) throw new Error(`${url} devolvió ${res.status()}`);
    const texto = (await res.body()).toString('utf8');
    await writeFile(join(COPIAS, url.split('/').pop()!), texto);
    return leerCsv(texto);
  };

  const filasDip = (await bajar(CSV_DIPUTADOS)).filter(f => legislaturaDe(f.LEGISLATURA) === LEGISLATURA);
  console.log(`\nDiputados en datos abiertos, legislatura ${LEGISLATURA}: ${filasDip.length}`);
  const altas = new Map<number, string>();
  const sinCruzarDip: string[] = [];
  for (const f of filasDip) {
    const nombre = `${f.NOMBRE} ${f.APELLIDOS || `${f.APELLIDO1} ${f.APELLIDO2}`}`;
    const d = cruzar(nombre, porClave, todos);
    const fecha = fechaIso(f.FECHA_INICIO);
    if (!d || !fecha) { sinCruzarDip.push(nombre); continue; }
    const previa = altas.get(d.id);
    if (!previa || fecha < previa) altas.set(d.id, fecha);
  }
  for (const [id, fecha] of altas) {
    const { error: e } = await db().from('asamblea_diputados').update({ fecha_alta: fecha }).eq('id_asamblea', id);
    if (e) console.log(`  aviso fecha_alta ${id}: ${e.message}`);
  }
  console.log(`  con fecha de alta: ${altas.size} de ${todos.length}`);
  if (sinCruzarDip.length) console.log(`  sin cruzar (${sinCruzarDip.length}): ${sinCruzarDip.slice(0, 20).join('; ')}`);

  const filasPleno = (await bajar(CSV_PLENOS)).filter(f => legislaturaDe(f.LEGISLATURA) === LEGISLATURA);
  console.log(`\nFilas de asistencia a Pleno, legislatura ${LEGISLATURA}: ${filasPleno.length}`);
  const tipos = new Map<string, number>();
  const cargosCsv = new Map<string, number>();
  const porFecha = new Map<string, Map<number, string>>();
  const sinCruzar = new Map<string, number>();
  for (const f of filasPleno) {
    tipos.set(f.TIPO_VOTO, (tipos.get(f.TIPO_VOTO) ?? 0) + 1);
    cargosCsv.set(f.CARGO, (cargosCsv.get(f.CARGO) ?? 0) + 1);
    const fecha = fechaIso(f.FECHA_PLENO);
    if (!fecha || fecha > new Date().toISOString().slice(0, 10)) continue;
    const d = cruzar(desdeApellidosComaNombre(f.NOMBRE), porClave, todos);
    if (!d) { sinCruzar.set(f.NOMBRE, (sinCruzar.get(f.NOMBRE) ?? 0) + 1); continue; }
    if (!porFecha.has(fecha)) porFecha.set(fecha, new Map());
    porFecha.get(fecha)!.set(d.id, f.TIPO_VOTO);
  }
  console.log(`  valores de TIPO_VOTO: ${[...tipos].map(([k, v]) => `${k || '(vacío)'} ${v}`).join(', ')}`);
  console.log(`  valores de CARGO: ${[...cargosCsv].map(([k, v]) => `${k || '(vacío)'} ${v}`).join(', ')}`);
  const tam = [...porFecha.values()].map(m => m.size);
  console.log(`  plenos: ${porFecha.size} · asistentes por pleno: mínimo ${Math.min(...tam)}, máximo ${Math.max(...tam)}, media ${(tam.reduce((a, b) => a + b, 0) / tam.length).toFixed(1)}`);
  const fechas = [...porFecha.keys()].sort();
  console.log(`  primer pleno ${fechas[0]} · último ${fechas[fechas.length - 1]}`);
  if (sinCruzar.size) console.log(`  nombres sin cruzar (${sinCruzar.size}): ${[...sinCruzar].slice(0, 25).map(([k, v]) => `${k} (${v})`).join('; ')}`);

  const plenos = [...porFecha].map(([fecha, m]) => ({ fecha, legislatura: LEGISLATURA, asistentes: m.size }));
  const { error: eP } = await db().from('asamblea_plenos').upsert(plenos, { onConflict: 'fecha' });
  if (eP) throw eP;
  const asistencia = [...porFecha].flatMap(([fecha, m]) => [...m].map(([id, tipo]) => ({ fecha, id_asamblea: id, tipo: tipo || null })));
  for (let i = 0; i < asistencia.length; i += 500) {
    const { error: eA } = await db().from('asamblea_asistencia').upsert(asistencia.slice(i, i + 500), { onConflict: 'fecha,id_asamblea' });
    if (eA) throw eA;
  }
  console.log(`  guardadas ${plenos.length} sesiones y ${asistencia.length} asistencias`);

  const { data: ranking } = await db().from('v_asamblea_asistencia').select('*').order('plenos_faltados', { ascending: false }).limit(15);
  console.log('\nMÁS FALTAS A PLENO (con su cargo, si lo tiene)');
  for (const r of ranking ?? []) {
    console.log(`  ${String(r.plenos_faltados).padStart(3)} de ${String(r.plenos_convocado).padStart(3)} · ${r.partido_siglas ?? '?'} · ${r.nombre_completo}${r.cargos ? ` · ${r.cargos}` : ''}${r.fecha_alta ? ` · alta ${r.fecha_alta}` : ''}`);
  }

  console.log('\n=== PÁGINA DE VOTACIONES');
  if (await cargar(page, `${BASE}/actividad/votaciones`)) {
    const ls = await lineas(page);
    await writeFile(join(COPIAS, 'votaciones.txt'), ls.join('\n'));
    const i = ls.findIndex(l => /^Votaciones$/i.test(l) && ls.indexOf(l) > 20);
    console.log(ls.slice(Math.max(0, i), Math.max(0, i) + 60).map(l => '    ' + l.slice(0, 160)).join('\n'));
    const vs = (await enlaces(page)).filter(e => /votaci|\.pdf|detalle|expediente/i.test(e.href) && !/#$/.test(e.href)).slice(0, 40);
    console.log('  enlaces:');
    for (const e of vs) console.log(`    ${e.texto.slice(0, 80)}  ->  ${e.href}`);
  }

  await navegador.close();
  console.log(`\nFIN. Pega toda la salida. Copias en ${COPIAS}`);
}

main().catch(e => { console.error(e); process.exit(1); });
