import { db } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { contarInmuebles } from '../src/lib/inmuebles.js';

const SIMULAR = process.argv.includes('--simular');
const LOTE = 200;

type Fila = {
  mandato_id: string;
  n_viviendas: number | null;
  n_viviendas_propias: number | null;
  n_inmuebles: number | null;
  inmuebles_detalle: string | null;
  inmuebles_detalle_propios: string | null;
  inmuebles_detalle_sociedad: string | null;
  inmuebles_urbanos: number | null;
  inmuebles_rusticos: number | null;
  confianza: string | null;
};

const filas = await traerTodo<Fila>((a, b) =>
  db().from('bienes_declarados')
    .select('mandato_id, n_viviendas, n_viviendas_propias, n_inmuebles, inmuebles_detalle, inmuebles_detalle_propios, inmuebles_detalle_sociedad, inmuebles_urbanos, inmuebles_rusticos, confianza')
    .order('mandato_id')
    .range(a, b));

console.log(`\n${filas.length} declaraciones leidas de bienes_declarados`);

const cambios: { mandato_id: string; n_viviendas_propias: number }[] = [];
let sinDesglose = 0;
let sinCambio = 0;
let cruzaUmbral = 0;
let discrepaTotal = 0;

for (const f of filas) {
  const hayDesglose = Boolean(f.inmuebles_detalle_propios || f.inmuebles_detalle_sociedad);
  if (!hayDesglose) { sinDesglose++; continue; }

  const inm = contarInmuebles(
    f.inmuebles_detalle,
    f.inmuebles_urbanos,
    f.inmuebles_rusticos,
    f.inmuebles_detalle_propios,
    f.inmuebles_detalle_sociedad
  );

  if (inm.n_viviendas_propias == null) continue;
  if (inm.n_inmuebles != null && f.n_inmuebles != null && inm.n_inmuebles !== Number(f.n_inmuebles)) discrepaTotal++;

  const antes = f.n_viviendas != null ? Number(f.n_viviendas) : null;
  const ahora = inm.n_viviendas_propias;
  if (antes != null && (antes >= 4) !== (ahora >= 4)) cruzaUmbral++;

  if (f.n_viviendas_propias != null && Number(f.n_viviendas_propias) === ahora) { sinCambio++; continue; }
  cambios.push({ mandato_id: f.mandato_id, n_viviendas_propias: ahora });
}

console.log(`  sin desglose, no se puede separar:   ${sinDesglose}`);
console.log(`  ya estaban al dia:                   ${sinCambio}`);
console.log(`  a escribir:                          ${cambios.length}`);
console.log(`  cruzan el umbral de 4 viviendas:     ${cruzaUmbral}`);
console.log(`  n_inmuebles guardado no cuadra:      ${discrepaTotal}`);

if (SIMULAR) {
  console.log('\n--simular: no se ha escrito nada.\n');
  process.exit(0);
}

let escritas = 0;
for (let i = 0; i < cambios.length; i += LOTE) {
  const trozo = cambios.slice(i, i + LOTE);
  for (const c of trozo) {
    const { error } = await db().from('bienes_declarados')
      .update({ n_viviendas_propias: c.n_viviendas_propias })
      .eq('mandato_id', c.mandato_id);
    if (error) {
      console.log(`ERROR ${c.mandato_id}: ${error.message}`);
      process.exit(1);
    }
    escritas++;
  }
  console.log(`  ${escritas}/${cambios.length}`);
}

const { error: eRefresco } = await db().rpc('refrescar_metricas');
if (eRefresco) console.log(`aviso: refrescar_metricas fallo (${eRefresco.message})`);

console.log(`\n${escritas} filas actualizadas.\n`);
