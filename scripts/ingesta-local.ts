import { ejecutarIngesta } from '../src/lib/congreso-adapter';
import { vaciarCola } from '../src/lib/resolver';
import { exigirEnv } from '../src/lib/supabase';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');
const dias = Number(process.argv[2] ?? 10);

console.log(`Revisando los ultimos ${dias} dias...`);
const ingesta = await ejecutarIngesta(legislaturaId, 'XV', dias);
console.log('Ingesta:', ingesta);

const cola = await vaciarCola(legislaturaId);
console.log('Cola:', cola);

export {};
