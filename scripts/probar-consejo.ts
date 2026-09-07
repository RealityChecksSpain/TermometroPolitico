import { Cadencia } from '../src/lib/gemini';
import {
  PROVEEDORES, Proveedor, leerConsejo, claveDe, listarModelos, preguntarMiembro
} from '../src/lib/consejo';

const args = process.argv.slice(2);
const opcion = (n: string) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
};

const filtro = opcion('proveedor');
const buscar = (opcion('buscar') ?? '').toLowerCase();
const soloLista = args.includes('--listar');

const conClave = PROVEEDORES.filter(p => process.env[claveDe(p)]?.trim());

if (!conClave.length) {
  console.error('\nNo hay ninguna clave de proveedor en el .env.');
  console.error(`Variables que busca: ${PROVEEDORES.map(claveDe).join(', ')}\n`);
  process.exit(1);
}

console.log('\n=== Modelos disponibles con tus claves ===\n');

for (const proveedor of conClave) {
  if (filtro && proveedor !== filtro) continue;
  const r = await listarModelos(proveedor);
  if (!r.ok) {
    console.log(`${proveedor}: ERROR ${r.error}\n`);
    continue;
  }
  const lista = (r.modelos ?? []).filter(m => !buscar || m.toLowerCase().includes(buscar));
  console.log(`${proveedor} (${lista.length}${buscar ? ` de ${r.modelos?.length}` : ''}):`);
  if (!lista.length) console.log('  (ninguno coincide)');
  for (const m of lista) console.log(`  ${proveedor}:${m}`);
  console.log('');
}

if (soloLista) process.exit(0);

let consejo;
try {
  consejo = leerConsejo();
} catch (e: any) {
  console.log('No hay CONSEJO configurado, asi que no se prueba ninguna llamada.');
  console.log('Copia arriba los identificadores que quieras y ponlos en CONSEJO.\n');
  process.exit(0);
}

console.log('=== Prueba de llamada real ===\n');

const cadencias = new Map<string, Cadencia>();
const prueba = 'Responde solo con este JSON exacto y nada mas: {"ok": true}';
let vivos = 0;

for (const miembro of consejo) {
  const t = Date.now();
  const r = await preguntarMiembro(miembro, prueba, { type: 'object', properties: { ok: { type: 'boolean' } } }, cadencias);
  const ms = Date.now() - t;
  if (r.ok) {
    vivos++;
    console.log(`  ${miembro.id.padEnd(46)} OK   ${ms} ms`);
  } else {
    console.log(`  ${miembro.id.padEnd(46)} FALLO ${String(r.error ?? '').slice(0, 90)}`);
  }
}

const familias = new Set(consejo.filter(() => true).map(m => m.proveedor)).size;

console.log('');
console.log(`Miembros vivos: ${vivos} de ${consejo.length}`);
console.log(`Familias configuradas: ${familias}`);
if (vivos < 3) console.log('Con menos de tres miembros vivos no hay mayoria posible en los empates.');
if (vivos >= 3 && familias < 2) console.log('Todos del mismo proveedor: el acuerdo mide estabilidad del prompt, no fiabilidad.');
console.log('');
