import { db } from '../src/lib/supabase';

async function leer(objeto: string): Promise<any[] | null> {
  const { data, error } = await db().from(objeto).select('*');
  if (error) {
    console.error(`  NO SE PUEDE LEER ${objeto}: ${error.message}`);
    return null;
  }
  return data ?? [];
}

function mostrar(titulo: string, filas: any[] | null) {
  console.log(`\n${titulo}`);
  if (filas === null) {
    console.log('  (sin datos: la lectura ha fallado, mira el error de arriba)');
    return;
  }
  if (filas.length === 0) {
    console.log('  (vacio)');
    return;
  }
  console.table(filas);
}

const cobertura = await leer('mv_cobertura');
const caido = await leer('v_etl_caido');
const mixto = await leer('v_partidos_sin_confirmar');

mostrar('COBERTURA', cobertura);
mostrar('FUENTES CAIDAS', caido);
mostrar('MIXTO SIN PARTIDO ASIGNADO', mixto);

const { count: pendientes, error: eCuenta } = await db()
  .from('cola_revision')
  .select('id', { count: 'exact', head: true })
  .eq('resuelto', false);

if (eCuenta) console.error(`  NO SE PUEDE CONTAR cola_revision: ${eCuenta.message}`);

const porNombre = new Map<string, { motivo: string; filas: number }>();
let cursor: string | null = null;

for (;;) {
  let consulta = db()
    .from('cola_revision')
    .select('id, nombre_origen, motivo')
    .eq('resuelto', false)
    .order('id', { ascending: true })
    .limit(1000);

  if (cursor !== null) consulta = consulta.gt('id', cursor);

  const { data, error } = await consulta;
  if (error) {
    console.error(`  NO SE PUEDE LEER cola_revision: ${error.message}`);
    break;
  }
  if (!data?.length) break;

  for (const fila of data) {
    const previo = porNombre.get(fila.nombre_origen);
    if (previo) previo.filas++;
    else porNombre.set(fila.nombre_origen, { motivo: fila.motivo, filas: 1 });
  }

  cursor = data[data.length - 1].id;
  if (data.length < 1000) break;
}

const orden = Array.from(porNombre.entries()).sort((a, b) => b[1].filas - a[1].filas);

console.log(`\nCOLA DE REVISION: ${pendientes ?? '?'} filas pendientes, ${orden.length} nombres distintos`);
orden.slice(0, 40).forEach(([nombre, d]) => {
  console.log(`  ${String(d.filas).padStart(6)}  ${nombre}  [${d.motivo}]`);
});