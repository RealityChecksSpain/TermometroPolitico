import { db } from '../src/lib/supabase';
import { detectarPerfil } from '../src/lib/perfil.js';

const { data: sinResolver } = await db()
  .from('v_busquedas_sin_resolver').select('*').limit(200);

const { data: todas } = await db()
  .from('busquedas_perfil').select('origen, veces, colectivos');

const porOrigen = new Map<string, number>();
let conResultado = 0, total = 0;
(todas ?? []).forEach((b: any) => {
  porOrigen.set(b.origen, (porOrigen.get(b.origen) ?? 0) + b.veces);
  total += b.veces;
  if (b.colectivos?.length) conResultado += b.veces;
});

console.log('\n=== BUSQUEDAS DE PERFIL ===\n');
console.log(`  consultas totales: ${total}`);
console.log(`  resueltas:         ${conResultado} (${total ? (conResultado / total * 100).toFixed(1) : 0}%)\n`);
console.log('  POR ORIGEN');
Array.from(porOrigen.entries()).sort((a, b) => b[1] - a[1])
  .forEach(([o, n]) => console.log(`    ${String(n).padStart(6)}  ${o}`));

if (!sinResolver?.length) {
  console.log('\n  Ninguna consulta sin resolver.\n');
  process.exit(0);
}

console.log(`\n  SIN RESOLVER: ${sinResolver.length}\n`);
sinResolver.slice(0, 40).forEach((b: any) => {
  const ahora = detectarPerfil(b.texto_original ?? '');
  const nota = ahora.colectivos.length
    ? `  → ahora SÍ: ${ahora.colectivos.join(',')}`
    : '';
  console.log(`    ${String(b.veces).padStart(4)}×  "${b.texto_original}"${nota}`);
});

const recuperadas = sinResolver.filter((b: any) => detectarPerfil(b.texto_original ?? '').colectivos.length);
if (recuperadas.length) {
  console.log(`\n  ${recuperadas.length} ya las resuelve el diccionario actual.`);
  console.log('  Marcalas como revisadas:');
  console.log(`    update busquedas_perfil set revisado = true where texto_normalizado in (${
    recuperadas.slice(0, 10).map((b: any) => `'${b.texto_normalizado}'`).join(', ')});`);
}

console.log('\n  Anade las que se repitan a DICCIONARIO en src/lib/perfil.js');
console.log('  y como caso nuevo en scripts/probar-perfil.ts\n');

export {};
