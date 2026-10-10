import { db } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { contarInmuebles } from '../src/lib/inmuebles.js';
import { refrescarMetricas } from '../src/lib/metricas';

const SIMULAR = process.argv.includes('--simular');
const LOTE = 200;

type Fila = {
  mandato_id: string;
  n_viviendas: number | null;
  n_viviendas_propias: number | null;
  n_viviendas_equivalentes: number | null;
  n_inmuebles_equivalentes: number | null;
  n_inmuebles: number | null;
  inmuebles_detalle: string | null;
  inmuebles_detalle_propios: string | null;
  inmuebles_detalle_sociedad: string | null;
  inmuebles_urbanos: number | null;
  inmuebles_rusticos: number | null;
  confianza: string | null;
  inmuebles_revisado?: string | null;
};

const COLUMNAS = 'mandato_id, n_viviendas, n_viviendas_propias, n_viviendas_equivalentes, n_inmuebles_equivalentes, n_inmuebles, inmuebles_detalle, inmuebles_detalle_propios, inmuebles_detalle_sociedad, inmuebles_urbanos, inmuebles_rusticos, confianza, inmuebles_revisado';

let filas: Fila[];
try {
  filas = await traerTodo<Fila>((a, b) =>
    db().from('bienes_declarados')
      .select(COLUMNAS)
      .order('mandato_id')
      .range(a, b));
} catch (e: any) {
  console.log(`\nNo se puede leer bienes_declarados (${e?.message ?? e}).`);
  console.log('Si falta la columna n_viviendas_equivalentes, corre antes en el SQL Editor sql/viviendas-equivalentes-2026-10-06.sql.\n');
  process.exit(1);
}

console.log(`\n${filas.length} declaraciones leidas de bienes_declarados`);

const cambios: { mandato_id: string; n_viviendas_propias: number; n_viviendas_equivalentes: number | null; n_inmuebles_equivalentes: number | null }[] = [];
let sinDesglose = 0;
let revisados = 0;
let sinCambio = 0;
let cruzaUmbral = 0;
let discrepaTotal = 0;
let cambianInmuebles = 0;

for (const f of filas) {
  if (f.inmuebles_revisado) { revisados++; continue; }
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

  const antes = f.n_viviendas_equivalentes != null ? Number(f.n_viviendas_equivalentes) : null;
  const ahora = inm.n_viviendas_equivalentes;
  if (antes != null && ahora != null && (antes >= 4) !== (ahora >= 4)) cruzaUmbral++;

  const inmueblesAntes = f.n_inmuebles_equivalentes != null ? Number(f.n_inmuebles_equivalentes) : null;
  const inmueblesAhora = inm.n_inmuebles_equivalentes;
  const igualesPropias = f.n_viviendas_propias != null && Number(f.n_viviendas_propias) === inm.n_viviendas_propias;
  const igualesEquivalentes = antes != null && antes === ahora;
  const igualesInmuebles = inmueblesAntes === inmueblesAhora;
  if (igualesPropias && igualesEquivalentes && igualesInmuebles) { sinCambio++; continue; }
  if (!igualesInmuebles) cambianInmuebles++;
  cambios.push({
    mandato_id: f.mandato_id,
    n_viviendas_propias: inm.n_viviendas_propias,
    n_viviendas_equivalentes: inm.n_viviendas_equivalentes,
    n_inmuebles_equivalentes: inmueblesAhora
  });
}

console.log(`  revisados a mano, sin tocar:         ${revisados}`);
console.log(`  sin desglose, no se puede separar:   ${sinDesglose}`);
console.log(`  ya estaban al dia:                   ${sinCambio}`);
console.log(`  a escribir:                          ${cambios.length}`);
console.log(`  cruzan la raya de 4 viviendas equivalentes: ${cruzaUmbral}`);
console.log(`  n_inmuebles guardado no cuadra:      ${discrepaTotal}`);
console.log(`  cambian los inmuebles equivalentes:  ${cambianInmuebles}`);

if (SIMULAR) {
  console.log('\n--simular: no se ha escrito nada.\n');
  process.exit(0);
}

let escritas = 0;
for (let i = 0; i < cambios.length; i += LOTE) {
  const trozo = cambios.slice(i, i + LOTE);
  for (const c of trozo) {
    const { error } = await db().from('bienes_declarados')
      .update({ n_viviendas_propias: c.n_viviendas_propias, n_viviendas_equivalentes: c.n_viviendas_equivalentes, n_inmuebles_equivalentes: c.n_inmuebles_equivalentes })
      .eq('mandato_id', c.mandato_id);
    if (error) {
      console.log(`ERROR ${c.mandato_id}: ${error.message}`);
      process.exit(1);
    }
    escritas++;
  }
  console.log(`  ${escritas}/${cambios.length}`);
}

await refrescarMetricas();

console.log(`\n${escritas} filas actualizadas.\n`);