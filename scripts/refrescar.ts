import { refrescarMetricas } from '../src/lib/metricas';

console.log('\nRefrescando metricas y cache de la web...');
const ok = await refrescarMetricas();
console.log(ok ? '\nHecho. Recarga la web para ver los datos nuevos.\n' : '\nHa fallado algo; mira los mensajes de arriba.\n');
process.exit(ok ? 0 : 1);

export {};
