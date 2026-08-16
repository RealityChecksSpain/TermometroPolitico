import { db } from '../src/lib/supabase';

const { data: cobertura } = await db().from('v_cobertura_datos').select('*');
const { data: caido } = await db().from('v_etl_caido').select('*');
const { data: mixto } = await db().from('v_partidos_sin_confirmar').select('*');
const { data: cola } = await db()
  .from('cola_revision')
  .select('nombre_origen, motivo')
  .eq('resuelto', false);

console.log('\nCOBERTURA');
console.table(cobertura ?? []);

console.log('\nFUENTES CAIDAS');
console.table(caido ?? []);

console.log('\nMIXTO SIN PARTIDO ASIGNADO');
console.table(mixto ?? []);

const unicos = new Map<string, string>();
(cola ?? []).forEach(c => unicos.set(c.nombre_origen, c.motivo));

console.log(`\nCOLA DE REVISION: ${unicos.size} nombres unicos`);
Array.from(unicos.entries()).slice(0, 40).forEach(([n, m]) => console.log(`  ${n}  [${m}]`));
