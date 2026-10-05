import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { UA } from '../src/lib/descubrir';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');
const CARPETA = join('datos', 'externas', 'declaraciones');
const PAUSA_MS = 600;
const INTENTOS = 3;
const BLOQUE = 200;

const args = process.argv.slice(2);

function opcion(nombre: string): string | null {
  const conIgual = args.find(a => a.startsWith(`--${nombre}=`));
  if (conIgual) return conIgual.slice(nombre.length + 3);
  const i = args.indexOf(`--${nombre}`);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return null;
}

const POSTERIORES = args.includes('--posteriores');
const MINIMO = Number(opcion('min-viviendas') ?? 3);
if (!Number.isInteger(MINIMO) || MINIMO < 0) {
  console.log('\n--min-viviendas tiene que ser un numero entero, por ejemplo --min-viviendas=3. Abortado.\n');
  process.exit(1);
}

function fechaDeUrl(url: unknown): string | null {
  const m = String(url ?? '').match(/_(\d{4})(\d{2})(\d{2})\.pdf$/i);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function registroDeUrl(url: string): string {
  const m = url.match(/_(\d+)_\d{8}\.pdf$/i);
  return m ? m[1] : (url.split('/').pop() ?? 'pdf').replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9]+/g, '_');
}

function nombreArchivo(nombre: string, url: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base}_${fechaDeUrl(url) ?? 'sin_fecha'}_${registroDeUrl(url)}.pdf`;
}

function dormir(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function descargar(url: string, destino: string): Promise<string | null> {
  let ultimo = '';
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.subarray(0, 4).toString() !== '%PDF') throw new Error('la respuesta no es un PDF');
      writeFileSync(destino, buf);
      return null;
    } catch (e: any) {
      ultimo = String(e?.cause?.code ?? e?.message ?? e);
      if (intento < INTENTOS) await dormir(2000 * intento);
    }
  }
  return ultimo;
}

async function leerPorBloques(tabla: string, columnas: string, ids: string[]) {
  const filas: any[] = [];
  for (let i = 0; i < ids.length; i += BLOQUE) {
    const { data, error } = await db().from(tabla).select(columnas).in('mandato_id', ids.slice(i, i + BLOQUE));
    if (error) return { filas, error };
    filas.push(...(data ?? []));
  }
  return { filas, error: null };
}

const { data: mandatos, error: eMandatos } = await db()
  .from('mandatos')
  .select('id, url_bienes, fecha_baja, politicos(nombre_completo)')
  .eq('legislatura_id', legislaturaId)
  .is('fecha_baja', null);
if (eMandatos) throw eMandatos;

const ids = (mandatos ?? []).map((m: any) => m.id as string);

const { filas: bienes, error: eBienes } = await leerPorBloques(
  'bienes_declarados',
  'mandato_id, n_viviendas_propias, n_inmuebles, inmuebles_revisado',
  ids
);
if (eBienes) throw eBienes;
const bienDe = new Map(bienes.map((b: any) => [b.mandato_id, b]));

const { filas: grupos } = await leerPorBloques('mv_diputados', 'mandato_id, partido_siglas', ids);
const siglasDe = new Map(grupos.map((g: any) => [g.mandato_id, g.partido_siglas]));

const elegidos = (mandatos ?? [])
  .map((m: any) => {
    const b: any = bienDe.get(m.id);
    return {
      id: m.id as string,
      nombre: String(m.politicos?.nombre_completo ?? m.id),
      siglas: String(siglasDe.get(m.id) ?? ''),
      url: (m.url_bienes as string | null) ?? null,
      ultima: fechaDeUrl(m.url_bienes),
      viviendas: (b?.n_viviendas_propias ?? null) as number | null,
      inmuebles: (b?.n_inmuebles ?? null) as number | null,
      revisado: (b?.inmuebles_revisado ?? null) as string | null
    };
  })
  .filter(d => POSTERIORES
    ? Boolean(d.revisado && d.ultima && d.ultima > d.revisado)
    : !d.revisado && d.viviendas != null && d.viviendas >= MINIMO)
  .sort((a, b) =>
    (b.viviendas ?? 0) - (a.viviendas ?? 0) ||
    (b.inmuebles ?? 0) - (a.inmuebles ?? 0) ||
    a.nombre.localeCompare(b.nombre, 'es'));

console.log(POSTERIORES
  ? `\nCon inmuebles revisados y una declaracion presentada despues de su revision: ${elegidos.length} diputados\n`
  : `\nSin revisar y con ${MINIMO} o mas viviendas segun la lectura automatica: ${elegidos.length} diputados\n`);

if (!elegidos.length) {
  console.log('No hay nada que descargar.\n');
  process.exit(0);
}

const documentosDe = new Map<string, string[]>();
const { filas: documentos, error: eDocs } = await leerPorBloques(
  'declaraciones_bienes',
  'mandato_id, documento_url',
  elegidos.map(d => d.id)
);
if (eDocs) console.log(`  aviso: no se pudo leer declaraciones_bienes (${eDocs.message}); se baja solo la ultima declaracion de cada uno.\n`);
for (const f of documentos) {
  if (!f.documento_url) continue;
  const lista = documentosDe.get(f.mandato_id) ?? [];
  if (!lista.includes(f.documento_url)) lista.push(f.documento_url);
  documentosDe.set(f.mandato_id, lista);
}

mkdirSync(CARPETA, { recursive: true });

let nuevos = 0, yaEstaban = 0, fallos = 0, sinPdf = 0;
console.log(`  ${'diputado'.padEnd(45)} ${'grupo'.padEnd(8)} viv  inm  PDF`);
for (const d of elegidos) {
  const urls = Array.from(new Set([...(documentosDe.get(d.id) ?? []), ...(d.url ? [d.url] : [])]))
    .sort((a, b) => (fechaDeUrl(a) ?? '').localeCompare(fechaDeUrl(b) ?? ''));
  if (!urls.length) {
    sinPdf++;
    console.log(`  ${d.nombre.slice(0, 44).padEnd(45)} sin enlace a su declaracion`);
    continue;
  }
  let bajadosAqui = 0;
  for (const url of urls) {
    const destino = join(CARPETA, nombreArchivo(d.nombre, url));
    if (existsSync(destino) && statSync(destino).size > 0) {
      yaEstaban++;
      bajadosAqui++;
      continue;
    }
    const fallo = await descargar(url, destino);
    if (fallo) {
      fallos++;
      console.log(`  ERROR ${d.nombre}: ${url} (${fallo})`);
      continue;
    }
    nuevos++;
    bajadosAqui++;
    await dormir(PAUSA_MS);
  }
  console.log(`  ${d.nombre.slice(0, 44).padEnd(45)} ${d.siglas.slice(0, 7).padEnd(8)} ${String(d.viviendas ?? '—').padStart(3)}  ${String(d.inmuebles ?? '—').padStart(3)}  ${bajadosAqui}/${urls.length}`);
}

console.log(`\nListo: ${nuevos} PDF nuevos, ${yaEstaban} ya estaban, ${fallos} fallos${sinPdf ? `, ${sinPdf} sin enlace` : ''}.`);
console.log(`Carpeta: ${CARPETA} (git no la sube).`);
if (fallos) console.log('Vuelve a lanzarlo para reintentar los que fallaron: los que ya estan no se descargan otra vez.');
console.log('Adjunta en el chat todos los PDF de esa carpeta.\n');
