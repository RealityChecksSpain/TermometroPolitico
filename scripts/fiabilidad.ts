import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, modeloActivo, Cadencia } from '../src/lib/gemini';
import { ESQUEMA, prompt } from '../src/lib/prompt-leyes';

exigirEnv('GEMINI_API_KEY');

const MUESTRA = Number(process.env.FIABILIDAD_N ?? 50);
const VERSION = process.env.VERSION_CODIGO_LEY ?? 'codigo-ley-v5-2026-08';

const DIMS = [
  'gasto_publico', 'impuestos', 'regulacion_mercado', 'propiedad_publica',
  'proteccion_laboral', 'proteccionismo', 'derechos_individuales', 'apertura_migratoria',
  'moral_tradicional', 'religion_estado', 'orden_publico', 'diversidad_cultural',
  'nacionalismo', 'autoridad_estatal', 'descentralizacion', 'integracion_europea',
  'ortodoxia_fiscal', 'igualdad_trato', 'medio_ambiente', 'calidad_democratica'
];

const VALORES = ['aumenta', 'reduce', 'neutro'];

function kappa(a: string[], b: string[]): number {
  const n = a.length;
  if (!n) return 0;
  let acuerdo = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) acuerdo++;
  const po = acuerdo / n;
  let pe = 0;
  for (const v of VALORES) {
    const pa = a.filter(x => x === v).length / n;
    const pb = b.filter(x => x === v).length / n;
    pe += pa * pb;
  }
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

function veredicto(k: number): string {
  if (k >= 0.80) return 'casi perfecto';
  if (k >= 0.60) return 'sustancial';
  if (k >= 0.40) return 'moderado';
  if (k >= 0.20) return 'debil';
  return 'insuficiente';
}

console.log('\n=== Fiabilidad entre modelos ===\n');

const codificadas = await traerTodo<any>((a, b) =>
  db().from('iniciativa_codigo').select('*').eq('version_prompt', VERSION).range(a, b));

if (!codificadas.length) {
  console.log(`No hay filas con version_prompt = ${VERSION}.`);
  process.exit(0);
}

const barajadas = [...codificadas].sort(() => Math.random() - 0.5).slice(0, MUESTRA);
const ids = barajadas.map(c => c.iniciativa_id);

const iniciativas = await traerTodo<any>((a, b) =>
  db().from('iniciativas').select('*').in('id', ids).range(a, b));
const porId = new Map(iniciativas.map(i => [i.id, i]));

const modelo = modeloActivo();
console.log(`Primer codificador: ${barajadas[0].modelo ?? 'desconocido'}`);
console.log(`Segundo codificador: ${modelo}`);
console.log(`Muestra: ${barajadas.length} normas\n`);

const cadencia = new Cadencia(modelo);
const original: Record<string, string[]> = {};
const replica: Record<string, string[]> = {};
for (const d of DIMS) { original[d] = []; replica[d] = []; }

let hechas = 0;
let fallidas = 0;

for (const c of barajadas) {
  const ini = porId.get(c.iniciativa_id);
  if (!ini) continue;
  const r = await preguntar<any>(prompt(ini), cadencia, { esquema: ESQUEMA });
  if (!r.ok || !r.datos) { fallidas++; continue; }
  for (const d of DIMS) {
    const v1 = String(c[d] ?? 'neutro');
    const v2 = VALORES.includes(r.datos[d]) ? r.datos[d] : 'neutro';
    original[d].push(v1);
    replica[d].push(v2);
  }
  hechas++;
  if (hechas % 10 === 0) console.log(`  ${hechas}/${barajadas.length}`);
}

console.log(`\nComparadas ${hechas}, fallidas ${fallidas}\n`);

if (!hechas) {
  console.log('Sin datos suficientes.');
  process.exit(0);
}

const filas: any[] = [];
console.log('DIMENSION                 ACUERDO   KAPPA   VEREDICTO');

let sumaK = 0;
let sumaA = 0;
for (const d of DIMS) {
  const a = original[d];
  const b = replica[d];
  const acuerdo = a.filter((x, i) => x === b[i]).length / a.length;
  const k = kappa(a, b);
  sumaK += k;
  sumaA += acuerdo;
  console.log(
    `  ${d.padEnd(23)} ${(acuerdo * 100).toFixed(1).padStart(6)} % ${k.toFixed(3).padStart(7)}   ${veredicto(k)}`
  );
  filas.push({
    dimension: d,
    muestra: hechas,
    modelo_a: barajadas[0].modelo ?? null,
    modelo_b: modelo,
    version_prompt: VERSION,
    acuerdo: Number(acuerdo.toFixed(4)),
    kappa: Number(k.toFixed(4)),
    calculado_at: new Date().toISOString()
  });
}

const kMedia = sumaK / DIMS.length;
console.log(`\n  ${'MEDIA'.padEnd(23)} ${((sumaA / DIMS.length) * 100).toFixed(1).padStart(6)} % ${kMedia.toFixed(3).padStart(7)}   ${veredicto(kMedia)}`);
console.log('\nEl acuerdo bruto engana cuando casi todo es "neutro": kappa lo corrige por azar.');
console.log('Por debajo de 0,40 la codificacion no es reproducible y el mapa no deberia publicarse.\n');

const { error } = await db().from('auditoria_fiabilidad').upsert(filas, {
  onConflict: 'dimension,version_prompt'
});
if (error) {
  console.log(`No se pudo guardar: ${error.message}`);
  console.log('Crea la tabla con sql/auditoria_fiabilidad.sql si quieres conservar el historico.');
} else {
  console.log(`Guardadas ${filas.length} filas en auditoria_fiabilidad.`);
}
