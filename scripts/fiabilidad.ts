import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, modeloActivo, Cadencia, CuotaDiariaAgotada } from '../src/lib/gemini';
import { ESQUEMA, prompt } from '../src/lib/prompt-leyes';

exigirEnv('GEMINI_API_KEY');

const MUESTRA = Number(process.env.FIABILIDAD_N ?? 50);
const MIN_MARCADAS = Number(process.env.FIABILIDAD_MIN_MARCADAS ?? 5);
const VERSION = process.env.VERSION_CODIGO_LEY ?? 'codigo-ley-v6-2026-09';

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

function veredicto(k: number | null, marcadas: number): string {
  if (k === null) return `sin base (${marcadas})`;
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
  console.log('Codifica primero con esa version: npm run codificar:leyes\n');
  process.exit(0);
}

const barajadas = [...codificadas].sort(() => Math.random() - 0.5).slice(0, MUESTRA);
const ids = barajadas.map(c => c.iniciativa_id);

const iniciativas = await traerTodo<any>((a, b) =>
  db().from('iniciativas').select('id, titulo, texto_extraido').in('id', ids).range(a, b));
const porId = new Map(iniciativas.map(i => [i.id, i]));

const modelo = modeloActivo();
const primeros = Array.from(new Set(barajadas.map(c => c.modelo ?? 'desconocido')));

if (primeros.includes(modelo)) {
  console.log(`El modelo activo (${modelo}) es tambien el que codifico la muestra.`);
  console.log('La prueba mide acuerdo entre modelos distintos. Lanza con MODELO_IA cambiado.\n');
  process.exit(0);
}

console.log(`Version prompt:      ${VERSION}`);
console.log(`Primer codificador:  ${primeros.join(', ')}`);
console.log(`Segundo codificador: ${modelo}`);
console.log(`Muestra:             ${barajadas.length} de ${codificadas.length} normas\n`);

const cadencia = new Cadencia(modelo);
const original: Record<string, string[]> = {};
const replica: Record<string, string[]> = {};
for (const d of DIMS) { original[d] = []; replica[d] = []; }

const errores = new Map<string, number>();
let hechas = 0;
let fallidas = 0;
let cortada = false;

for (const c of barajadas) {
  const ini = porId.get(c.iniciativa_id);
  if (!ini) continue;

  let r;
  try {
    r = await preguntar<any>(prompt(ini), cadencia, { esquema: ESQUEMA });
  } catch (e) {
    if (e instanceof CuotaDiariaAgotada) {
      cortada = true;
      console.log(`\n  Cuota de ${modelo} agotada tras ${hechas} normas.`);
      break;
    }
    throw e;
  }

  if (!r.ok || !r.datos) {
    const e = r.error ?? 'sin detalle';
    errores.set(e, (errores.get(e) ?? 0) + 1);
    fallidas++;
    continue;
  }
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

if (hechas > 0 && hechas < 20) {
  console.log(`Muestra de ${hechas}: la kappa no es interpretable por dimension.`);
  console.log('Con casi todo "neutro", coincidir en pocos casos devuelve 1,000 sin significar nada.');
  console.log('Sirve para comprobar que la tuberia funciona, no para decidir si se publica.\n');
}

if (errores.size > 0) {
  console.log('ERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 160)}`));
  console.log('');
}

if (!hechas) {
  console.log('Sin datos suficientes.');
  console.log('Si el error es HTTP 400 por JSON mode, relanza con SIN_ESQUEMA=true.\n');
  process.exit(0);
}

const filas: any[] = [];
console.log('DIMENSION                 MARCADAS  ACUERDO   KAPPA   VEREDICTO');

let sumaK = 0;
let sumaA = 0;
let validas = 0;
const sinBase: string[] = [];

for (const d of DIMS) {
  const a = original[d];
  const b = replica[d];
  const marcadas = a.filter((x, i) => x !== 'neutro' || b[i] !== 'neutro').length;
  const acuerdo = a.filter((x, i) => x === b[i]).length / a.length;
  const k = marcadas < MIN_MARCADAS ? null : kappa(a, b);

  if (k === null) sinBase.push(d);
  else { sumaK += k; sumaA += acuerdo; validas++; }

  console.log(
    `  ${d.padEnd(23)} ${String(marcadas).padStart(6)}   ${(acuerdo * 100).toFixed(1).padStart(6)} % ` +
    `${(k === null ? '—' : k.toFixed(3)).padStart(7)}   ${veredicto(k, marcadas)}`
  );

  filas.push({
    dimension: d,
    muestra: hechas,
    marcadas,
    modelo_a: primeros.join(', '),
    modelo_b: modelo,
    version_prompt: VERSION,
    acuerdo: Number(acuerdo.toFixed(4)),
    kappa: k === null ? null : Number(k.toFixed(4)),
    calculado_at: new Date().toISOString()
  });
}

console.log('\nMARCADAS: normas donde alguno de los dos modelos NO dijo "neutro".');
console.log(`Por debajo de ${MIN_MARCADAS} la kappa no se calcula: sin variacion devuelve 0 o 1 por construccion,`);
console.log('y ninguno de los dos numeros dice nada sobre si la dimension es reproducible.');

if (validas === 0) {
  console.log('\nNinguna dimension tiene base suficiente en esta muestra.\n');
  process.exit(0);
}

const kMedia = sumaK / validas;
console.log(`\n  ${'MEDIA'.padEnd(23)} ${String(validas).padStart(6)}   ${((sumaA / validas) * 100).toFixed(1).padStart(6)} % ${kMedia.toFixed(3).padStart(7)}   ${veredicto(kMedia, MIN_MARCADAS)}`);
console.log(`  media sobre las ${validas} dimensiones con base, no sobre las ${DIMS.length}`);

if (sinBase.length) {
  console.log(`\nSin base en esta muestra: ${sinBase.join(', ')}.`);
  console.log('Son dimensiones que el Congreso apenas toca. Para auditarlas hace falta');
  console.log('una muestra dirigida, no una al azar de 50 normas.');
}

console.log('\nEl acuerdo bruto engana cuando casi todo es "neutro": kappa lo corrige por azar.');
console.log('Por debajo de 0,40 la codificacion no es reproducible y el mapa no deberia publicarse.\n');

if (cortada) {
  console.log(`Corrida incompleta: ${hechas} de ${barajadas.length} previstas.\n`);
}

if (hechas < 20) {
  console.log('No se guarda: muestra insuficiente para el historico.\n');
  process.exit(0);
}

const { error } = await db().from('auditoria_fiabilidad').upsert(filas, {
  onConflict: 'dimension,version_prompt'
});
if (error) {
  console.log(`No se pudo guardar: ${error.message}`);
  console.log('Crea la tabla con sql/auditoria_fiabilidad.sql si quieres conservar el historico.');
} else {
  console.log(`Guardadas ${filas.length} filas en auditoria_fiabilidad.`);
}

export {};