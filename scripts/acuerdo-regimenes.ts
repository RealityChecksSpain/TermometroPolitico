import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { DIMENSIONES } from '../src/lib/prompt-regimenes';

exigirEnv('SUPABASE_URL');
exigirEnv('SUPABASE_SERVICE_ROLE_KEY');

const args = process.argv.slice(2);
const opcion = (n: string) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
};

const VERSION = opcion('version') || process.env.VERSION_REGIMEN || 'regimen-v1';
const soloDudosas = args.includes('--dudosas');

const acuerdos = await traerTodo<any>((a, b) =>
  db().from('v_regimen_acuerdo')
    .select('entidad_clave, dimension, valor, votantes, acuerdo')
    .eq('version_prompt', VERSION)
    .order('entidad_clave')
    .range(a, b));

if (!acuerdos.length) {
  console.log(`\nNo hay codificaciones con la version ${VERSION}.\n`);
  process.exit(0);
}

const citas = await traerTodo<any>((a, b) =>
  db().from('regimen_codigo_voto')
    .select('entidad_clave, dimension, modelo, valor, cita')
    .eq('version_prompt', VERSION)
    .order('entidad_clave')
    .range(a, b));

const entidades = await traerTodo<any>((a, b) =>
  db().from('entidades_externas').select('clave, nombre_corto, nombre').range(a, b));
const nombre = new Map(entidades.map((e: any) => [e.clave, e.nombre_corto || e.nombre]));

const porRegimen = new Map<string, any[]>();
for (const a of acuerdos) {
  if (!porRegimen.has(a.entidad_clave)) porRegimen.set(a.entidad_clave, []);
  porRegimen.get(a.entidad_clave)!.push(a);
}

console.log(`\n=== Acuerdo del consejo · ${VERSION} ===`);
console.log('acuerdo 1.00 = todos los codificadores dijeron lo mismo.');
console.log('Por debajo de 0.67 la dimension no deberia sostener una posicion publicada.\n');

let bajas = 0;

for (const [clave, filas] of Array.from(porRegimen.entries()).sort()) {
  const orden = new Map(DIMENSIONES.map((d, i) => [d, i]));
  const lista = [...filas].sort((a, b) =>
    a.acuerdo - b.acuerdo || (orden.get(a.dimension) ?? 99) - (orden.get(b.dimension) ?? 99));

  const votantes = lista[0]?.votantes ?? 0;
  const medio = lista.reduce((s, f) => s + Number(f.acuerdo), 0) / lista.length;

  if (votantes < 2) {
    console.log(`--- ${nombre.get(clave) ?? clave}   SIN CONTRASTE: ${votantes} codificador`);
    console.log('    Con un solo codificador no hay acuerdo que medir. No publicar.\n');
    continue;
  }

  console.log(`--- ${nombre.get(clave) ?? clave}   acuerdo medio ${medio.toFixed(2)}   ${votantes} codificadores`);
  if (votantes < 3) {
    console.log('    Con dos codificadores no hay mayoria posible: todo empate cae en neutro.');
  }

  for (const f of lista) {
    const bajo = Number(f.acuerdo) < 0.67;
    if (bajo) bajas++;
    void 0;
    if (soloDudosas && !bajo) continue;
    console.log(
      `  ${Number(f.acuerdo).toFixed(2)}  ${String(f.dimension).padEnd(22)} ${String(f.valor).padEnd(8)}` +
      (bajo ? '  <-- sin mayoria clara' : '')
    );
    if (bajo || soloDudosas) {
      const detalle = citas.filter((c: any) => c.entidad_clave === clave && c.dimension === f.dimension);
      for (const d of detalle) {
        console.log(`        ${String(d.modelo).padEnd(44)} ${String(d.valor).padEnd(8)} ${String(d.cita ?? '').slice(0, 90)}`);
      }
    }
  }
  console.log('');
}

console.log(`Dimensiones sin mayoria clara: ${bajas} de ${acuerdos.length}\n`);