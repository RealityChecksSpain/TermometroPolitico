import { db } from '../src/lib/supabase';
import { contarInmuebles } from '../src/lib/inmuebles.js';
import { refrescarMetricas } from '../src/lib/metricas';

const aplicar = process.argv.includes('--aplicar');

const CAMPOS = [
  'n_inmuebles', 'n_inmuebles_propios', 'n_inmuebles_sociedad', 'n_inmuebles_equivalentes',
  'n_viviendas', 'n_viviendas_propias', 'n_viviendas_equivalentes',
  'n_suelo', 'n_anejos', 'n_productivos', 'n_otros_bienes'
] as const;

const DETALLE = 'inmuebles_detalle_propios, inmuebles_detalle_sociedad, inmuebles_urbanos, inmuebles_rusticos, inmuebles_revisado';

type Cambio = { camara: string; clave: string; nombre: string; antes: string; ahora: string; patch: Record<string, number | null> };

function numero(v: unknown): number | null {
  return v == null || v === '' ? null : Number(v);
}

function resumen(f: Record<string, any>): string {
  return `${numero(f.n_inmuebles) ?? '-'} inm · ${numero(f.n_inmuebles_equivalentes) ?? '-'} eq · ${numero(f.n_viviendas_equivalentes) ?? '-'} viv eq`;
}

function cambioDe(fila: Record<string, any>): Record<string, number | null> | null {
  if (fila.inmuebles_revisado) return null;
  if (!fila.inmuebles_detalle_propios && !fila.inmuebles_detalle_sociedad) return null;
  const inm: Record<string, any> = contarInmuebles(
    null,
    fila.inmuebles_urbanos,
    fila.inmuebles_rusticos,
    fila.inmuebles_detalle_propios,
    fila.inmuebles_detalle_sociedad
  );
  if (inm.fuente !== 'desglose' || !inm.n_inmuebles) return null;
  const patch: Record<string, number | null> = {};
  for (const c of CAMPOS) {
    if (!(c in fila)) continue;
    const nuevo = inm[c] == null ? null : Number(inm[c]);
    if (nuevo !== numero(fila[c])) patch[c] = nuevo;
  }
  return Object.keys(patch).length ? patch : null;
}

async function todas(tabla: string, columnas: string): Promise<Record<string, any>[]> {
  const filas: Record<string, any>[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db().from(tabla).select(columnas).range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...((data ?? []) as unknown as Record<string, any>[]));
    if (!data || data.length < 1000) return filas;
  }
}

const cambios: Cambio[] = [];

{
  const bienes = await todas('asamblea_bienes', `id_asamblea, ${DETALLE}, ${CAMPOS.join(', ')}`);
  const diputados = await todas('asamblea_diputados', 'id_asamblea, nombre_completo');
  const nombres = new Map(diputados.map(d => [String(d.id_asamblea), String(d.nombre_completo)]));
  for (const f of bienes) {
    const patch = cambioDe(f);
    if (!patch) continue;
    cambios.push({
      camara: 'Madrid',
      clave: String(f.id_asamblea),
      nombre: nombres.get(String(f.id_asamblea)) ?? String(f.id_asamblea),
      antes: resumen(f),
      ahora: resumen({ ...f, ...patch }),
      patch
    });
  }
}

{
  const bienes = await todas('bienes_declarados', `mandato_id, ${DETALLE}, ${CAMPOS.join(', ')}`);
  const diputados = await todas('mv_diputados', 'mandato_id, nombre_completo');
  const nombres = new Map(diputados.map(d => [String(d.mandato_id), String(d.nombre_completo)]));
  for (const f of bienes) {
    const patch = cambioDe(f);
    if (!patch) continue;
    cambios.push({
      camara: 'Congreso',
      clave: String(f.mandato_id),
      nombre: nombres.get(String(f.mandato_id)) ?? String(f.mandato_id),
      antes: resumen(f),
      ahora: resumen({ ...f, ...patch }),
      patch
    });
  }
}

console.log(`\nRECUENTO DE INMUEBLES  ${aplicar ? 'APLICANDO' : 'SIMULACIÓN (nada se guarda)'}\n`);
for (const camara of ['Madrid', 'Congreso']) {
  const lista = cambios.filter(c => c.camara === camara).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  console.log(`${camara}: ${lista.length} declaraciones cambian`);
  for (const c of lista) console.log(`  ${c.nombre}\n    antes ${c.antes}\n    ahora ${c.ahora}`);
  console.log('');
}

if (!aplicar) {
  console.log('Revisa la lista. Para guardar: npm run inmuebles:recontar -- --aplicar\n');
  process.exit(0);
}

let hechos = 0;
for (const c of cambios) {
  const tabla = c.camara === 'Madrid' ? 'asamblea_bienes' : 'bienes_declarados';
  const clave = c.camara === 'Madrid' ? 'id_asamblea' : 'mandato_id';
  const { error } = await db().from(tabla).update(c.patch).eq(clave, c.clave);
  if (error) console.error(`  ${c.nombre}: ${error.message}`);
  else hechos++;
}
console.log(`Guardadas ${hechos} de ${cambios.length}.\n`);
if (hechos) await refrescarMetricas();
