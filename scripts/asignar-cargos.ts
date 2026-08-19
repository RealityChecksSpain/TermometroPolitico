import { db, exigirEnv } from '../src/lib/supabase';
import { readFile } from 'fs/promises';

exigirEnv('SUPABASE_URL');
const FICHERO = process.argv[2] ?? './cargos.txt';

if (process.argv.includes('--candidatos')) {
  const { data } = await db().rpc('candidatos_a_cargo');
  console.log('\nDIPUTADOS CON MAS DE 100 AUSENCIAS');
  console.log('Son los candidatos probables a tener cargo institucional.\n');
  console.log('  AUSENCIAS   %     PARTIDO      NOMBRE                              CARGO ACTUAL');
  (data ?? []).forEach((d: any) => {
    console.log(
      `  ${String(d.ausencias).padStart(6)}  ${String(d.pct_ausencias).padStart(5)}%   ` +
      `${String(d.partido_siglas ?? '').padEnd(10)}  ${String(d.nombre_completo).padEnd(36)}  ${d.cargo_actual ?? '—'}`
    );
  });
  console.log(`
Crea un fichero cargos.txt con una linea por persona:

  Sánchez Pérez-Castejón | Presidente del Gobierno
  Díaz Pérez, Yolanda | Vicepresidenta y Ministra de Trabajo

Comprueba cada cargo en la fuente oficial antes de escribirlo.
Luego ejecuta: npm run cargos
`);
  process.exit(0);
}

let texto: string;
try {
  texto = await readFile(FICHERO, 'utf8');
} catch {
  console.error(`\nNo existe ${FICHERO}.`);
  console.error('Genera la lista de candidatos con: npm run cargos:candidatos\n');
  process.exit(1);
}

const lineas = texto.split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .map(l => l.split('|').map(p => p.trim()))
  .filter(p => p.length === 2);

console.log(`\n${lineas.length} cargos a asignar\n`);

let ok = 0, fallos = 0;
for (const [nombre, cargo] of lineas) {
  const { data, error } = await db().rpc('asignar_cargo', { p_nombre: nombre, p_cargo: cargo });
  if (error) { console.log(`  ERROR  ${nombre}: ${error.message}`); fallos++; continue; }
  console.log('  ' + data);
  if (String(data).startsWith('OK')) ok++; else fallos++;
}

console.log(`\n  asignados: ${ok}   sin encontrar: ${fallos}`);
await db().rpc('refrescar_metricas');
console.log('  metricas refrescadas\n');

export {};
