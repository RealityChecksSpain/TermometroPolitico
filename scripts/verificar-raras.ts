import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, modeloActivo, Cadencia, CuotaDiariaAgotada } from '../src/lib/gemini';
import { ESQUEMA, prompt } from '../src/lib/prompt-leyes';

exigirEnv('GEMINI_API_KEY');

const VERSION = process.env.VERSION_CODIGO_LEY ?? 'codigo-ley-v6-2026-09';
const DIMS = (process.env.RARAS ?? 'religion_estado,ortodoxia_fiscal,propiedad_publica,proteccionismo,apertura_migratoria')
  .split(',').map(d => d.trim()).filter(Boolean);
const CONTROLES = Number(process.env.RARAS_CONTROLES ?? 1);

console.log('\n=== Verificacion dirigida de dimensiones raras ===\n');

const codificadas = await traerTodo<any>((a, b) =>
  db().from('iniciativa_codigo').select('*').eq('version_prompt', VERSION).range(a, b));

if (!codificadas.length) {
  console.log(`No hay filas con version_prompt = ${VERSION}.\n`);
  process.exit(0);
}

const modelo = modeloActivo();
const primeros = Array.from(new Set(codificadas.map(c => c.modelo ?? 'desconocido')));
if (primeros.includes(modelo)) {
  console.log(`El modelo activo (${modelo}) tambien codifico estas normas.`);
  console.log('Lanza con MODELO_IA cambiado.\n');
  process.exit(0);
}

const elegidas = new Map<string, any>();
const marcadasPorDim = new Map<string, string[]>();

for (const d of DIMS) {
  const marcadas = codificadas.filter(c => c[d] && c[d] !== 'neutro');
  const neutras = codificadas.filter(c => !c[d] || c[d] === 'neutro');
  const control = [...neutras].sort(() => Math.random() - 0.5).slice(0, marcadas.length * CONTROLES);
  marcadasPorDim.set(d, marcadas.map(c => c.iniciativa_id));
  [...marcadas, ...control].forEach(c => elegidas.set(c.iniciativa_id, c));
  console.log(`  ${d.padEnd(23)} ${String(marcadas.length).padStart(4)} marcadas + ${String(control.length).padStart(4)} de control`);
}

const lista = Array.from(elegidas.values());
console.log(`\nNormas distintas a recodificar: ${lista.length}`);
console.log(`Primer codificador:  ${primeros.join(', ')}`);
console.log(`Segundo codificador: ${modelo}\n`);

const ids = lista.map(c => c.iniciativa_id);
const iniciativas = await traerTodo<any>((a, b) =>
  db().from('iniciativas').select('id, titulo, texto_extraido').in('id', ids).range(a, b));
const porId = new Map(iniciativas.map(i => [i.id, i]));

const cadencia = new Cadencia(modelo);
const replica = new Map<string, any>();
const errores = new Map<string, number>();
let hechas = 0;
let fallidas = 0;

for (const c of lista) {
  const ini = porId.get(c.iniciativa_id);
  if (!ini) continue;
  let r;
  try {
    r = await preguntar<any>(prompt(ini), cadencia, { esquema: ESQUEMA });
  } catch (e) {
    if (e instanceof CuotaDiariaAgotada) {
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
  replica.set(c.iniciativa_id, r.datos);
  hechas++;
  if (hechas % 10 === 0) console.log(`  ${hechas}/${lista.length}`);
}

console.log(`\nRecodificadas ${hechas}, fallidas ${fallidas}\n`);

if (errores.size > 0) {
  console.log('ERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 160)}`));
  console.log('');
}

if (!hechas) {
  console.log('Sin datos suficientes.\n');
  process.exit(0);
}

console.log('DIMENSION                 CONFIRMA   ANADE   n   LECTURA');

for (const d of DIMS) {
  const marcadas = (marcadasPorDim.get(d) ?? []).filter(id => replica.has(id));
  const controles = Array.from(replica.keys())
    .filter(id => !(marcadasPorDim.get(d) ?? []).includes(id));

  const confirmadas = marcadas.filter(id => {
    const original = codificadas.find(c => c.iniciativa_id === id)?.[d];
    return replica.get(id)?.[d] === original;
  }).length;

  const anadidas = controles.filter(id => {
    const v = replica.get(id)?.[d];
    return v && v !== 'neutro';
  }).length;

  const confirma = marcadas.length ? (confirmadas / marcadas.length) * 100 : null;
  const lectura = confirma === null ? 'sin casos'
    : confirma >= 80 ? 'solida'
    : confirma >= 60 ? 'aceptable'
    : 'no reproducible';

  console.log(
    `  ${d.padEnd(23)} ${(confirma === null ? '—' : confirma.toFixed(0) + ' %').padStart(8)}` +
    ` ${String(anadidas).padStart(7)} ${String(marcadas.length).padStart(4)}   ${lectura}`
  );
}

console.log('\nCONFIRMA: de las normas que el primer modelo marco con direccion, en cuantas');
console.log('coincide el segundo. ANADE: normas que el primero dejo en neutro y el segundo');
console.log('marca. No es kappa y no debe publicarse como tal: la muestra esta elegida');
console.log('mirando la etiqueta del primer codificador, asi que mide confirmacion, no acuerdo.');
console.log('Un ANADE alto con un CONFIRMA alto significa que el primer modelo se queda corto,');
console.log('no que discrepen.\n');

export {};