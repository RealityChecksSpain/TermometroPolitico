import { vaciarCola } from '../src/lib/resolver';
import { db, exigirEnv } from '../src/lib/supabase';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');

const { count: alInicio } = await db()
  .from('cola_revision')
  .select('id', { count: 'exact', head: true })
  .eq('resuelto', false);

console.log(`\nVotos huerfanos al inicio: ${alInicio ?? 0}\n`);

let vuelta = 0;
let anterior = alInicio ?? 0;

while (true) {
  vuelta++;
  const r = await vaciarCola(legislaturaId, 1000);

  console.log(
    `  vuelta ${String(vuelta).padStart(2)}  procesados ${String(r.procesados).padStart(5)}  ` +
    `resueltos ${String(r.resueltos).padStart(5)}  quedan ${r.quedanPendientes}  ` +
    `[${Object.entries(r.porOrigen).map(([k, v]) => `${k}:${v}`).join(' ')}]`
  );

  if (r.procesados === 0) break;
  if (r.quedanPendientes >= anterior) {
    console.log('\n  Sin progreso. Lo que queda no lo resuelve ningun nivel.');
    break;
  }
  anterior = r.quedanPendientes;
  if (vuelta > 60) break;
}

const { data: restantes } = await db()
  .from('cola_revision')
  .select('nombre_origen, motivo')
  .eq('resuelto', false);

const unicos = new Map<string, string>();
(restantes ?? []).forEach(r => unicos.set(r.nombre_origen, r.motivo));

console.log(`\nRESULTADO`);
console.log(`  votos huerfanos:  ${alInicio ?? 0} -> ${restantes?.length ?? 0}`);
console.log(`  nombres unicos:   ${unicos.size}`);

if (unicos.size > 0) {
  console.log('\nSIN RESOLVER');
  Array.from(unicos.entries()).forEach(([n, m]) => console.log(`  ${n}  [${m}]`));
}

console.log('');
export {};
