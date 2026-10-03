import { readFileSync, existsSync } from 'node:fs';
import { db, exigirEnv } from '../src/lib/supabase';
import { contarInmuebles } from '../src/lib/inmuebles.js';
import { refrescarMetricas } from '../src/lib/metricas';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');

const RUTA = 'datos/bienes/inmuebles-revisados.csv';
const CABECERA = ['diputado', 'buscar', 'fecha_declaracion', 'urbanos', 'rusticos', 'inmuebles_propios', 'inmuebles_sociedad', 'revisado', 'nota'];
const LARGO_NOTA = 600;
const publicar = process.argv.includes('--publicar');

function partirCSV(texto: string): string[][] {
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
      continue;
    }
    if (c === '"') { comillas = true; continue; }
    if (c === ',') { fila.push(campo); campo = ''; continue; }
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    if (c === '\r') continue;
    campo += c;
  }
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(v => v.trim() !== ''));
}

function llano(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fechaISO(v: string): string | null {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return Number.isNaN(Date.parse(t)) ? null : t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function fechaES(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function entero(v: string): number | null {
  if (!/^\d+$/.test(v.trim())) return null;
  return Number(v.trim());
}

if (!existsSync(RUTA)) {
  console.log(`\nNo existe ${RUTA}.\n`);
  process.exit(1);
}

const crudo = partirCSV(readFileSync(RUTA, 'utf8').replace(/^﻿/, ''));
const cabecera = (crudo[0] ?? []).map(c => c.trim());
const faltan = CABECERA.filter(c => !cabecera.includes(c));
if (faltan.length) {
  console.log(`\nFaltan columnas en ${RUTA}: ${faltan.join(', ')}\n`);
  process.exit(1);
}
const col = (f: string[], nombre: string) => (f[cabecera.indexOf(nombre)] ?? '').trim();

const { data: mandatos, error: eMandatos } = await db()
  .from('mandatos')
  .select('id, fecha_baja, politicos(nombre_completo)')
  .eq('legislatura_id', legislaturaId);
if (eMandatos) throw eMandatos;

const conNombre = (mandatos ?? []).map((m: any) => ({
  id: m.id as string,
  baja: m.fecha_baja as string | null,
  nombre: String(m.politicos?.nombre_completo ?? ''),
  llano: llano(m.politicos?.nombre_completo)
}));

const problemas: string[] = [];
const cambios: any[] = [];
const vistos = new Set<string>();

crudo.slice(1).forEach((f, i) => {
  const n = i + 2;
  const diputado = col(f, 'diputado');
  const buscar = llano(col(f, 'buscar'));
  const fecha = fechaISO(col(f, 'fecha_declaracion'));
  const revisado = fechaISO(col(f, 'revisado'));
  const urbanos = entero(col(f, 'urbanos'));
  const rusticos = entero(col(f, 'rusticos'));
  const propios = col(f, 'inmuebles_propios').replace(/\s+/g, ' ');
  const sociedad = col(f, 'inmuebles_sociedad').replace(/\s+/g, ' ');
  const nota = col(f, 'nota').replace(/\s+/g, ' ');

  if (!diputado) { problemas.push(`fila ${n}: falta el diputado`); return; }
  if (!buscar) { problemas.push(`fila ${n} (${diputado}): falta buscar`); return; }
  if (!fecha) { problemas.push(`fila ${n} (${diputado}): fecha_declaracion "${col(f, 'fecha_declaracion')}" no vale`); return; }
  if (!revisado) { problemas.push(`fila ${n} (${diputado}): revisado "${col(f, 'revisado')}" no vale`); return; }
  if (urbanos === null || rusticos === null) { problemas.push(`fila ${n} (${diputado}): urbanos y rusticos van en numero entero`); return; }
  if (!propios && !sociedad) { problemas.push(`fila ${n} (${diputado}): sin inmuebles`); return; }
  if (nota.length > LARGO_NOTA) { problemas.push(`fila ${n} (${diputado}): nota de ${nota.length} caracteres, el maximo es ${LARGO_NOTA}`); return; }

  const conteo = contarInmuebles(null, urbanos, rusticos, propios || null, sociedad || null);
  if (conteo.n_inmuebles_propios !== urbanos + rusticos) {
    problemas.push(`fila ${n} (${diputado}): el texto de bienes propios da ${conteo.n_inmuebles_propios} inmuebles y urbanos + rusticos suman ${urbanos + rusticos}. Reescribe el texto o corrige las cifras`);
    return;
  }

  const tokens = buscar.split(' ');
  const candidatos = conNombre.filter(m => tokens.every(t => m.llano.split(' ').includes(t)));
  const activos = candidatos.filter(m => !m.baja);
  const elegidos = activos.length ? activos : candidatos;
  const personas = new Set(elegidos.map(m => m.llano));
  if (elegidos.length === 0) { problemas.push(`fila ${n} (${diputado}): "${buscar}" no coincide con ningun diputado de la legislatura`); return; }
  if (personas.size > 1 || elegidos.length > 1) {
    problemas.push(`fila ${n} (${diputado}): "${buscar}" coincide con varios: ${elegidos.map(m => m.nombre).join(', ')}. Afina buscar`);
    return;
  }
  const mandato = elegidos[0];
  if (vistos.has(mandato.id)) { problemas.push(`fila ${n} (${diputado}): ${mandato.nombre} ya aparece en otra fila`); return; }
  vistos.add(mandato.id);

  cambios.push({
    fila: n,
    diputado,
    mandato_id: mandato.id,
    nombre: mandato.nombre,
    datos: {
      inmuebles_detalle: [propios, sociedad].filter(Boolean).join('; '),
      inmuebles_detalle_propios: propios || null,
      inmuebles_detalle_sociedad: sociedad || null,
      inmuebles_urbanos: urbanos,
      inmuebles_rusticos: rusticos,
      n_inmuebles: conteo.n_inmuebles,
      n_inmuebles_propios: conteo.n_inmuebles_propios,
      n_inmuebles_sociedad: conteo.n_inmuebles_sociedad,
      n_inmuebles_equivalentes: conteo.n_inmuebles_equivalentes,
      n_viviendas: conteo.n_viviendas,
      n_viviendas_propias: conteo.n_viviendas_propias,
      n_suelo: conteo.n_suelo,
      n_anejos: conteo.n_anejos,
      n_productivos: conteo.n_productivos,
      n_otros_bienes: conteo.n_otros_bienes,
      inmuebles_revisado: revisado,
      inmuebles_nota: `Declaración registrada el ${fechaES(fecha)}.${nota ? ` ${nota}` : ''}`
    }
  });
});

const ids = cambios.map(c => c.mandato_id);
const { data: actuales, error: eActuales } = ids.length
  ? await db().from('bienes_declarados').select('*').in('mandato_id', ids)
  : { data: [], error: null };
if (eActuales) throw eActuales;
const actualDe = new Map((actuales ?? []).map((a: any) => [a.mandato_id, a]));

for (const c of cambios) {
  if (!actualDe.has(c.mandato_id)) {
    problemas.push(`fila ${c.fila} (${c.diputado}): ${c.nombre} no tiene declaracion cargada en bienes_declarados. Cargala antes con bienes:auto`);
  }
}

console.log(`\n${RUTA}: ${cambios.length} diputados\n`);
console.log(`  ${'diputado'.padEnd(46)} viviendas propias      inmuebles`);
for (const c of cambios) {
  const a: any = actualDe.get(c.mandato_id) ?? {};
  const antesV = a.n_viviendas_propias ?? '—';
  const antesI = a.n_inmuebles ?? '—';
  console.log(`  ${c.nombre.slice(0, 45).padEnd(46)} ${String(antesV).padStart(4)} → ${String(c.datos.n_viviendas_propias).padEnd(10)} ${String(antesI).padStart(4)} → ${c.datos.n_inmuebles}`);
}

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s). No se ha escrito nada:\n`);
  for (const p of problemas) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}

if (!publicar) {
  console.log('\nNo se ha escrito nada. Anade --publicar para guardar.\n');
  process.exit(0);
}

const { error: eColumnas } = await db().from('bienes_declarados').select('inmuebles_revisado, inmuebles_nota').limit(1);
if (eColumnas) {
  console.log(`\nERROR: a bienes_declarados le faltan las columnas nuevas (${eColumnas.message}).`);
  console.log('Corre antes el SQL de la migracion. No se ha tocado nada.\n');
  process.exit(1);
}

let escritas = 0;
for (const c of cambios) {
  const { error } = await db().from('bienes_declarados').update(c.datos).eq('mandato_id', c.mandato_id);
  if (error) {
    console.log(`\nERROR en ${c.nombre}: ${error.message}`);
    console.log(`Se han guardado ${escritas} de ${cambios.length}. Corrige y vuelve a lanzar: es seguro repetirlo.\n`);
    process.exit(1);
  }
  escritas++;
}

console.log(`\nGuardados: ${escritas} diputados con los inmuebles revisados a mano.`);
await refrescarMetricas();
console.log('La carga automatica de bienes ya no pisa estos inmuebles; el dinero sigue leyendose del PDF.\n');
