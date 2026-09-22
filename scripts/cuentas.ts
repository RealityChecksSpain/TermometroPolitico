import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { motivoUrlInvalida } from '../src/lib/fuenteUrl';
import { anfitrion, tituloDocumento } from '../src/lib/documentoCuentas';

exigirEnv('SUPABASE_URL');

const CONCEPTOS = [
  'ingresos_publicos_ordinarios',
  'subvenciones_funcionamiento',
  'aportaciones_grupos_institucionales',
  'ingresos_privados',
  'cuotas_afiliados',
  'aportaciones_cargos_publicos',
  'donaciones_y_legados',
  'ingresos_electorales_publicos',
  'gastos_personal',
  'gastos_ordinarios',
  'gastos_electorales',
  'gastos_financieros',
  'resultado_ejercicio',
  'deuda_entidades_credito',
  'total_activo',
  'patrimonio_neto'
];

const ADMITE_NEGATIVO = new Set(['resultado_ejercicio', 'patrimonio_neto', 'ingresos_electorales_publicos']);

const CABECERA = ['partido', 'ejercicio', 'concepto', 'importe', 'fuente_url', 'pagina', 'nota'];
const CARPETA = 'datos/cuentas';

function opcion(nombre: string): string | null {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : '';
}

const ejercicio = Number(opcion('ejercicio') ?? '') || 0;
const plantilla = process.argv.includes('--plantilla');
const publicar = process.argv.includes('--publicar');

if (!ejercicio) {
  console.log('\nFalta --ejercicio. Ejemplo:');
  console.log('  npm run cuentas:plantilla -- --ejercicio 2024');
  console.log('  npm run cuentas -- --ejercicio 2024 --publicar\n');
  process.exit(1);
}

const ruta = join(CARPETA, `${ejercicio}.csv`);

function partirCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
      continue;
    }
    if (c === '"') { comillas = true; continue; }
    if (c === ',') { fila.push(campo); campo = ''; continue; }
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    if (c === '\r') continue;
    campo += c;
  }
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(v => v.trim() !== ''));
}

function escapar(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const { data: partidos, error: ePartidos } = await db()
  .from('partidos')
  .select('id, slug, siglas, web');
if (ePartidos) throw ePartidos;

const porClave = new Map<string, any>();
for (const p of partidos ?? []) {
  if (p.slug) porClave.set(String(p.slug).toLowerCase(), p);
  if (p.siglas) porClave.set(String(p.siglas).toLowerCase(), p);
}

if (plantilla) {
  mkdirSync(CARPETA, { recursive: true });
  if (existsSync(ruta)) {
    console.log(`\n${ruta} ya existe. Borralo a mano si quieres regenerarlo.\n`);
    process.exit(1);
  }

  const conWeb = (partidos ?? []).filter(p => String(p.web ?? '').trim() !== '');
  const lineas = [CABECERA.join(',')];
  for (const p of conWeb) {
    for (const c of CONCEPTOS) {
      lineas.push([p.slug, ejercicio, c, '', '', '', ''].map(escapar).join(','));
    }
  }
  writeFileSync(ruta, lineas.join('\n') + '\n', 'utf8');

  console.log(`\n${ruta}`);
  console.log(`  ${conWeb.length} partidos x ${CONCEPTOS.length} conceptos`);
  console.log(`  ${conWeb.length * CONCEPTOS.length} filas por rellenar\n`);
  console.log('  importe en euros, con punto decimal y sin separador de miles.');
  console.log('  Los gastos van en positivo.');
  console.log('  Si un concepto no aparece en el documento, BORRA la fila.');
  console.log('  No la dejes a cero: la ausencia es informacion.\n');
  process.exit(0);
}

if (!existsSync(ruta)) {
  console.log(`\nNo existe ${ruta}. Genera la plantilla primero:`);
  console.log(`  npm run cuentas:plantilla -- --ejercicio ${ejercicio}\n`);
  process.exit(1);
}

const crudo = partirCSV(readFileSync(ruta, 'utf8').replace(/^\uFEFF/, ''));
const cabecera = crudo[0].map(c => c.trim());
const faltan = CABECERA.filter(c => !cabecera.includes(c));
if (faltan.length) {
  console.log(`\nFaltan columnas en ${ruta}: ${faltan.join(', ')}\n`);
  process.exit(1);
}

const col = (fila: string[], nombre: string) => (fila[cabecera.indexOf(nombre)] ?? '').trim();

const problemas: string[] = [];
const vistas = new Set<string>();
const filas: any[] = [];

for (let i = 1; i < crudo.length; i++) {
  const f = crudo[i];
  const n = i + 1;
  const clave = col(f, 'partido').toLowerCase();
  const p = porClave.get(clave);
  const concepto = col(f, 'concepto');
  const ej = Number(col(f, 'ejercicio'));
  const bruto = col(f, 'importe');
  const url = col(f, 'fuente_url');
  const pagina = col(f, 'pagina');

  if (!p) { problemas.push(`fila ${n}: "${col(f, 'partido')}" no es ningun partido`); continue; }
  if (!CONCEPTOS.includes(concepto)) { problemas.push(`fila ${n}: concepto "${concepto}" no valido`); continue; }
  if (ej !== ejercicio) { problemas.push(`fila ${n}: ejercicio ${ej} no es ${ejercicio}`); continue; }

  if (bruto === '') { problemas.push(`fila ${n}: importe vacio en ${p.slug}/${concepto}. Rellenalo o borra la fila`); continue; }
  const importe = Number(bruto.replace(/\s/g, ''));
  if (!Number.isFinite(importe)) { problemas.push(`fila ${n}: importe "${bruto}" no es un numero`); continue; }
  if (importe < 0 && !ADMITE_NEGATIVO.has(concepto)) {
    problemas.push(`fila ${n}: importe negativo en ${concepto}. Los gastos van en positivo`);
    continue;
  }

  const urlMal = motivoUrlInvalida(url);
  if (urlMal) { problemas.push(`fila ${n}: fuente_url ${urlMal}`); continue; }
  if (pagina !== '' && !Number.isInteger(Number(pagina))) { problemas.push(`fila ${n}: pagina "${pagina}" no es entero`); continue; }

  const llave = `${p.id}:${ejercicio}:${concepto}`;
  if (vistas.has(llave)) { problemas.push(`fila ${n}: repetida (${p.slug}/${concepto})`); continue; }
  vistas.add(llave);

  filas.push({
    partido_id: p.id,
    slug: p.slug,
    siglas: p.siglas ?? p.slug,
    ejercicio,
    concepto,
    importe,
    pagina: pagina === '' ? null : Number(pagina),
    fuente_url: url,
    nota: col(f, 'nota') || null
  });
}

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s) en ${ruta}. No se ha escrito nada:\n`);
  for (const p of problemas) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}

if (filas.length === 0) {
  console.log(`\n${ruta} no tiene ninguna fila rellena.\n`);
  process.exit(1);
}

const urls = Array.from(new Set(filas.map(f => f.fuente_url)));

const uso = new Map<string, { conceptos: Set<string>; slugs: Set<string>; siglas: Set<string> }>();
for (const f of filas) {
  let u = uso.get(f.fuente_url);
  if (!u) { u = { conceptos: new Set(), slugs: new Set(), siglas: new Set() }; uso.set(f.fuente_url, u); }
  u.conceptos.add(f.concepto);
  u.slugs.add(f.slug);
  u.siglas.add(f.siglas);
}

function documentoNuevo(url: string) {
  const u = uso.get(url)!;
  if (u.slugs.size > 1) {
    return {
      tipo: 'informe_fiscalizacion',
      organismo: anfitrion(url) || 'desconocido',
      titulo: tituloDocumento(u.conceptos, '', ejercicio, true),
      ejercicio_desde: ejercicio,
      ejercicio_hasta: ejercicio,
      url
    };
  }
  return {
    tipo: 'cuentas_anuales',
    organismo: [...u.slugs][0],
    titulo: tituloDocumento(u.conceptos, [...u.siglas][0], ejercicio),
    ejercicio_desde: ejercicio,
    ejercicio_hasta: ejercicio,
    url
  };
}

const { data: docs, error: eDocs } = await db()
  .from('documentos')
  .select('id, url, ejercicio_desde, ejercicio_hasta')
  .in('url', urls);
if (eDocs) throw eDocs;

const porUrl = new Map((docs ?? []).map(d => [d.url, d.id]));
const sinDoc = urls.filter(u => !porUrl.has(u));

const aEnsanchar = (docs ?? []).filter(d =>
  (d.ejercicio_desde != null && ejercicio < d.ejercicio_desde) ||
  (d.ejercicio_hasta != null && ejercicio > d.ejercicio_hasta)
);

console.log(`\n${ruta}: ${filas.length} filas validas, ${vistas.size} combinaciones`);

if (sinDoc.length) {
  console.log(`\n${sinDoc.length} documento(s) que faltan en la tabla documentos:`);
  for (const u of sinDoc) console.log(`  ${documentoNuevo(u).titulo}\n    ${u}`);
}
if (aEnsanchar.length) {
  console.log(`\n${aEnsanchar.length} documento(s) que pasan a cubrir tambien ${ejercicio}:`);
  for (const d of aEnsanchar) console.log(`  ${d.url}`);
}

if (!publicar) {
  console.log('\nNo se ha escrito nada. Anade --publicar para cargar.\n');
  process.exit(0);
}

if (sinDoc.length) {
  const { data: creados, error: eCrear } = await db()
    .from('documentos')
    .insert(sinDoc.map(documentoNuevo))
    .select('id, url');
  if (eCrear) {
    console.log(`\nERROR al crear documentos: ${eCrear.message}`);
    console.log('No se ha cargado nada. Corrige y vuelve a lanzar.\n');
    process.exit(1);
  }
  for (const d of creados ?? []) porUrl.set(d.url, d.id);
  console.log(`\n${creados?.length ?? 0} documento(s) creados.`);
}

for (const d of aEnsanchar) {
  const desde = Math.min(d.ejercicio_desde ?? ejercicio, ejercicio);
  const hasta = Math.max(d.ejercicio_hasta ?? ejercicio, ejercicio);
  const u = uso.get(d.url);
  const cambios: Record<string, unknown> = { ejercicio_desde: desde, ejercicio_hasta: hasta };
  if (u) cambios.titulo = tituloDocumento(u.conceptos, [...u.siglas][0], desde, u.slugs.size > 1, hasta);
  const { error: eAncho } = await db().from('documentos').update(cambios).eq('id', d.id);
  if (eAncho) console.log(`  aviso: no se pudo ensanchar ${d.url}: ${eAncho.message}`);
  else console.log(`  ${d.url}\n    ahora cubre ${desde}-${hasta}`);
}

const sigueSinDoc = urls.filter(u => !porUrl.has(u));
if (sigueSinDoc.length) {
  console.log(`\n${sigueSinDoc.length} URL siguen sin documento_id:`);
  for (const u of sigueSinDoc) console.log(`  ${u}`);
}

const aEscribir = filas.map(f => ({
  partido_id: f.partido_id,
  ejercicio: f.ejercicio,
  concepto: f.concepto,
  importe: f.importe,
  pagina: f.pagina,
  documento_id: porUrl.get(f.fuente_url) ?? null,
  confianza: 'transcrito',
  nota: f.nota
}));

const { error: eBorrar } = await db().from('cuenta_partido').delete().eq('ejercicio', ejercicio);
if (eBorrar) throw eBorrar;

const { error: eInsertar } = await db().from('cuenta_partido').insert(aEscribir);
if (eInsertar) {
  console.log(`\nERROR al insertar: ${eInsertar.message}`);
  console.log(`El ejercicio ${ejercicio} ha quedado a medias. Vuelve a lanzar con --publicar.\n`);
  process.exit(1);
}

console.log(`\nCargado: ejercicio ${ejercicio} reemplazado con ${aEscribir.length} filas.\n`);