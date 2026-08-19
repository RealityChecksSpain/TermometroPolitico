import { db, exigirEnv } from '../src/lib/supabase';
import { normalizarNombre } from '../src/lib/texto';
import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';

exigirEnv('LEGISLATURA_ACTIVA_ID');
const legislaturaId = process.env.LEGISLATURA_ACTIVA_ID!;

function extraerFilas(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const k of Object.keys(json)) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && typeof json[k] === 'object') {
      for (const k2 of Object.keys(json[k])) if (Array.isArray(json[k][k2])) return json[k][k2];
    }
  }
  return [];
}

function aIso(v: any): string | null {
  const m = String(v ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

const limpiar = (v: any) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s || null;
};

console.log('\nLocalizando fichero de declaraciones...');
const html = await descargarHtml(`${BASE_CONGRESO}/es/opendata/diputados`);
const url = masReciente(extraerUrls(html, /webpublica\/opendata\/diputados\/docacteco[^"'\s<>]*\.json/));
if (!url) throw new Error('No se encontro docacteco');
console.log('  ' + url);

const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
const filas = extraerFilas(await res.json());
console.log(`  ${filas.length} registros`);

const tipos = new Map<string, number>();
const declaraciones = new Map<string, number>();
const sectores = new Map<string, number>();
filas.forEach((f: any) => {
  const t = limpiar(f.TIPO); if (t) tipos.set(t, (tipos.get(t) ?? 0) + 1);
  const d = limpiar(f.DECLARACION); if (d) declaraciones.set(d, (declaraciones.get(d) ?? 0) + 1);
  const s = limpiar(f.SECTOR); if (s) sectores.set(s, (sectores.get(s) ?? 0) + 1);
});

const tabla = (m: Map<string, number>, t: string) => {
  console.log(`\n  ${t}`);
  Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([k, n]) => console.log(`    ${String(n).padStart(5)}  ${k.slice(0, 70)}`));
};
tabla(tipos, 'VALORES DE TIPO');
tabla(declaraciones, 'VALORES DE DECLARACION');
tabla(sectores, 'VALORES DE SECTOR');

console.log('\nCargando indice de politicos...');
const indice = new Map<string, string>();
let desde = 0;
for (;;) {
  const { data, error } = await db()
    .from('mandatos')
    .select('politico_id, politicos!inner(nombre, apellidos)')
    .eq('legislatura_id', legislaturaId)
    .range(desde, desde + 999);
  if (error) throw error;
  if (!data?.length) break;
  data.forEach((m: any) => {
    indice.set(normalizarNombre(`${m.politicos.apellidos}, ${m.politicos.nombre}`), m.politico_id);
  });
  if (data.length < 1000) break;
  desde += 1000;
}

const { data: alias } = await db().from('alias_diputados').select('alias_normalizado, politico_id');
(alias ?? []).forEach((a: any) => { if (!indice.has(a.alias_normalizado)) indice.set(a.alias_normalizado, a.politico_id); });
console.log(`  ${indice.size} claves`);

const lote: any[] = [];
const sinResolver = new Map<string, number>();

filas.forEach((f: any, i: number) => {
  const nombre = limpiar(f.NOMBRE);
  if (!nombre) return;
  const normalizado = normalizarNombre(nombre.replace(/,(\S)/, ', $1'));
  const politicoId = indice.get(normalizado) ?? null;
  if (!politicoId) sinResolver.set(nombre, (sinResolver.get(nombre) ?? 0) + 1);

  lote.push({
    politico_id: politicoId,
    nombre_origen: nombre,
    fecha_registro: aIso(f.FECHAREGISTRO),
    tipo_declaracion: limpiar(f.DECLARACION),
    tipo: limpiar(f.TIPO),
    periodo: limpiar(f.PERIODO),
    empleador: limpiar(f.EMPLEADOR),
    sector: limpiar(f.SECTOR),
    descripcion: limpiar(f.DESCRIPCION),
    fuente_url: url,
    clave_unica: `${normalizado}|${f.FECHAREGISTRO}|${f.TIPO}|${f.PERIODO}|${i}`
  });
});

console.log(`\n  ${lote.length} filas · ${lote.filter(l => l.politico_id).length} resueltas`);
if (sinResolver.size > 0) {
  console.log(`  ${sinResolver.size} nombres sin resolver:`);
  Array.from(sinResolver.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([n, c]) => console.log(`    ${String(c).padStart(4)}  ${n}`));
}

console.log('\nInsertando...');
let ok = 0;
for (let i = 0; i < lote.length; i += 500) {
  const { error } = await db().from('actividades_declaradas')
    .upsert(lote.slice(i, i + 500), { onConflict: 'clave_unica' });
  if (error) { console.error('  ' + error.message); break; }
  ok += Math.min(500, lote.length - i);
}
console.log(`  ${ok} guardadas`);

await db().rpc('refrescar_metricas');
console.log('\nComprueba:');
console.log("  select empleador, count(*) from actividades_declaradas where sector ilike '%privad%' group by empleador order by 2 desc limit 20;\n");

export {};
