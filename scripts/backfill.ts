import { ingestarFechas, rangoFechas } from '../src/lib/congreso-adapter';
import { exigirEnv } from '../src/lib/supabase';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');

const desde = process.argv[2] ?? '2023-08-17';
const hasta = process.argv[3] ?? new Date().toISOString().slice(0, 10);
const legislatura = process.argv[4] ?? 'XV';

const fechas = rangoFechas(desde, hasta);

console.log(`\nBACKFILL ${legislatura}`);
console.log(`  rango:  ${desde} -> ${hasta}`);
console.log(`  dias:   ${fechas.length} laborables`);
console.log(`  tiempo estimado: ~${Math.round((fechas.length * 1.4) / 60)} min\n`);

let conVotaciones = 0;

const resumen = await ingestarFechas(fechas, legislaturaId, legislatura, {
  pausaMs: 700,
  alProgreso: (i, total, fecha, n) => {
    if (n > 0) {
      conVotaciones++;
      console.log(`  [${String(i).padStart(4)}/${total}] ${fecha}  ${n} votaciones`);
    } else if (i % 25 === 0) {
      console.log(`  [${String(i).padStart(4)}/${total}] ${fecha}  ...`);
    }
  }
});

console.log('\nRESUMEN');
console.log(`  dias con sesion:     ${conVotaciones}`);
console.log(`  votaciones halladas: ${resumen.descubiertas}`);
console.log(`  nuevas procesadas:   ${resumen.procesadas}`);
console.log(`  con error:           ${resumen.conError}`);
console.log(`  nombres sin resolver: ${resumen.nombresSinResolver.length}`);

if (resumen.nombresSinResolver.length > 0) {
  resumen.nombresSinResolver.slice(0, 20).forEach(n => console.log('    ' + n));
}
if (resumen.errores.length > 0) {
  console.log('\nERRORES');
  resumen.errores.forEach(e => console.log('  ' + e.slice(0, 160)));
}

console.log('\nSIGUIENTE: npm run cola:estado\n');

export {};
