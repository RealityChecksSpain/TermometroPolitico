import { db, exigirEnv } from '../src/lib/supabase';

exigirEnv('LEGISLATURA_ACTIVA_ID');

console.log('\nEnlazando votaciones con iniciativas por similitud de titulo...\n');

let total = 0;
let enlazadas = 0;

for (let vuelta = 1; vuelta <= 40; vuelta++) {
  const { data, error } = await db().rpc('enlazar_lote', { p_limite: 150, p_umbral: 0.5 });
  if (error) { console.error('  ' + error.message); break; }

  const r = Array.isArray(data) ? data[0] : data;
  const proc = r?.procesadas ?? 0;
  const enl = r?.enlazadas ?? 0;
  total += proc;
  enlazadas += enl;

  console.log(`  vuelta ${String(vuelta).padStart(2)}  procesadas ${String(proc).padStart(4)}  enlazadas ${String(enl).padStart(4)}  acumulado ${enlazadas}/${total}`);

  if (proc === 0) break;
}

const { count: conEnlace } = await db()
  .from('votacion_iniciativa')
  .select('votacion_id', { count: 'exact', head: true });

const { count: sinEnlace } = await db()
  .from('votacion_sin_enlace')
  .select('votacion_id', { count: 'exact', head: true });

console.log('\nRESULTADO');
console.log(`  votaciones con iniciativa: ${conEnlace ?? 0}`);
console.log(`  votaciones sin iniciativa: ${sinEnlace ?? 0}`);
console.log('  (PNL, mociones e interpelaciones no estan en el open data de iniciativas)');

await db().rpc('refrescar_metricas');
console.log('\nMetricas refrescadas.\n');

export {};
