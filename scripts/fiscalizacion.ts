import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { motivoUrlInvalida } from '../src/lib/fuenteUrl';

exigirEnv('SUPABASE_URL');

const MATERIAS = [
  'contabilidad',
  'financiacion',
  'donaciones',
  'gastos',
  'personal',
  'contratacion',
  'tesoreria',
  'transparencia',
  'otros'
];

const CABECERA = ['partido', 'ejercicio', 'apartado', 'materia', 'resumen', 'importe', 'fuente_url', 'pagina'];
const CARPETA = 'datos/fiscalizacion';
const LARGO_MAXIMO = 220;

function opcion(nombre: string): string | null {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : '';
}

const ejercicio = Number(opcion('ejercicio') ?? '') || 0;
const plantilla = process.argv.includes('--plantilla');
const publicar = process.argv.includes('--publicar');
const tituloOpcion = (opcion('titulo') ?? '').trim();

if (!ejercicio) {
  console.log('\nFalta --ejercicio. Ejemplo:');
  console.log('  npm run fiscalizacion:plantilla -- --ejercicio 2020');
  console.log('  npm run fiscalizacion -- --ejercicio 2020');
  console.log('  npm run fiscalizacion -- --ejercicio 2020 --publicar\n');
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

function euros(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

if (plantilla) {
  mkdirSync(CARPETA, { recursive: true });
  if (existsSync(ruta)) {
    console.log(`\n${ruta} ya existe. Borralo a mano si quieres regenerarlo.\n`);
    process.exit(1);
  }
  writeFileSync(ruta, CABECERA.join(',') + '\n', 'utf8');
  console.log(`\n${ruta}`);
  console.log('  Una fila por reparo del informe.');
  console.log(`  materia: ${MATERIAS.join(', ')}.`);
  console.log(`  resumen: frase en lenguaje llano que empieza por verbo, de ${LARGO_MAXIMO} caracteres como mucho.`);
  console.log('  importe: euros con punto decimal y sin separador de miles. Vacio si el reparo no tiene cifra.');
  console.log('  pagina: la del PDF del informe. Obligatoria.');
  console.log('  fuente_url: la direccion del PDF del informe.\n');
  process.exit(0);
}

if (!existsSync(ruta)) {
  console.log(`\nNo existe ${ruta}. Genera la plantilla primero:`);
  console.log(`  npm run fiscalizacion:plantilla -- --ejercicio ${ejercicio}\n`);
  process.exit(1);
}

const { data: partidos, error: ePartidos } = await db()
  .from('partidos')
  .select('id, slug, siglas');
if (ePartidos) throw ePartidos;

const porClave = new Map<string, any>();
for (const p of partidos ?? []) {
  if (p.slug) porClave.set(String(p.slug).toLowerCase(), p);
  if (p.siglas) porClave.set(String(p.siglas).toLowerCase(), p);
}

const crudo = partirCSV(readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
if (crudo.length === 0) {
  console.log(`\n${ruta} esta vacio.\n`);
  process.exit(1);
}
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
  const p = porClave.get(col(f, 'partido').toLowerCase());
  const ej = Number(col(f, 'ejercicio'));
  const materia = col(f, 'materia');
  const resumen = col(f, 'resumen').replace(/\s+/g, ' ');
  const bruto = col(f, 'importe');
  const url = col(f, 'fuente_url');
  const pagina = col(f, 'pagina');

  if (!p) { problemas.push(`fila ${n}: "${col(f, 'partido')}" no es ningun partido`); continue; }
  if (ej !== ejercicio) { problemas.push(`fila ${n}: ejercicio ${col(f, 'ejercicio')} no es ${ejercicio}`); continue; }
  if (!MATERIAS.includes(materia)) { problemas.push(`fila ${n}: materia "${materia}" no valida`); continue; }
  if (!resumen) { problemas.push(`fila ${n}: resumen vacio`); continue; }
  if (resumen.length > LARGO_MAXIMO) { problemas.push(`fila ${n}: resumen de ${resumen.length} caracteres, el maximo es ${LARGO_MAXIMO}`); continue; }
  if (/\.\.\.|…/.test(resumen)) { problemas.push(`fila ${n}: el resumen lleva puntos suspensivos; escribelo entero`); continue; }

  let importe: number | null = null;
  if (bruto !== '') {
    importe = Number(bruto.replace(/\s/g, ''));
    if (!Number.isFinite(importe)) { problemas.push(`fila ${n}: importe "${bruto}" no es un numero`); continue; }
    if (importe < 0) { problemas.push(`fila ${n}: importe negativo`); continue; }
  }

  const urlMal = motivoUrlInvalida(url);
  if (urlMal) { problemas.push(`fila ${n}: fuente_url ${urlMal}`); continue; }
  if (pagina === '' || !Number.isInteger(Number(pagina)) || Number(pagina) < 1) {
    problemas.push(`fila ${n}: pagina "${pagina}" no vale. Es obligatoria y va en numero entero`);
    continue;
  }

  const llave = `${p.id}:${pagina}:${resumen.toLowerCase()}`;
  if (vistas.has(llave)) { problemas.push(`fila ${n}: repetida (${p.slug}, pagina ${pagina})`); continue; }
  vistas.add(llave);

  filas.push({
    partido_id: p.id,
    siglas: p.siglas ?? p.slug,
    apartado: col(f, 'apartado'),
    materia,
    resumen,
    importe,
    pagina: Number(pagina),
    fuente_url: url
  });
}

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s) en ${ruta}. No se ha escrito nada:\n`);
  for (const p of problemas) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}

if (filas.length === 0) {
  console.log(`\n${ruta} no tiene ningun reparo.\n`);
  process.exit(1);
}

const porPartido = new Map<string, { n: number; total: number }>();
for (const f of filas) {
  const a = porPartido.get(f.siglas) ?? { n: 0, total: 0 };
  a.n += 1;
  a.total += f.importe ?? 0;
  porPartido.set(f.siglas, a);
}

console.log(`\n${ruta}: ${filas.length} reparos de ${porPartido.size} partidos`);
for (const [siglas, a] of [...porPartido.entries()].sort((x, y) => y[1].total - x[1].total)) {
  console.log(`  ${siglas.padEnd(12)} ${String(a.n).padStart(3)} reparo${a.n === 1 ? ' ' : 's'}   ${a.total ? euros(a.total) : 'sin cifra'}`);
}
if (porPartido.size < 3) {
  console.log('\n  Aviso: con menos de tres partidos el hallazgo de la portada no se publica.');
}

const urls = Array.from(new Set(filas.map(f => f.fuente_url)));
const { data: docs, error: eDocs } = await db()
  .from('documentos')
  .select('id, url')
  .in('url', urls);
if (eDocs) throw eDocs;

const porUrl = new Map((docs ?? []).map(d => [d.url, d.id]));
const sinDoc = urls.filter(u => !porUrl.has(u));
const titulo = tituloOpcion || `Informe de fiscalización del Tribunal de Cuentas, ejercicio ${ejercicio}`;

if (sinDoc.length) {
  console.log(`\n${sinDoc.length} documento(s) que faltan en la tabla documentos:`);
  for (const u of sinDoc) console.log(`  ${titulo}\n    ${u}`);
}

if (!publicar) {
  console.log('\nNo se ha escrito nada. Anade --publicar para cargar.\n');
  process.exit(0);
}

if (sinDoc.length) {
  const { data: creados, error: eCrear } = await db()
    .from('documentos')
    .insert(sinDoc.map(url => ({
      tipo: 'informe_fiscalizacion',
      organismo: 'Tribunal de Cuentas',
      titulo,
      ejercicio_desde: ejercicio,
      ejercicio_hasta: ejercicio,
      url
    })))
    .select('id, url');
  if (eCrear) {
    console.log(`\nERROR al crear documentos: ${eCrear.message}`);
    console.log('No se ha cargado nada. Corrige y vuelve a lanzar.\n');
    process.exit(1);
  }
  for (const d of creados ?? []) porUrl.set(d.url, d.id);
  console.log(`\n${creados?.length ?? 0} documento(s) creados.`);
}

const aEscribir = filas.map(f => {
  const fila: Record<string, unknown> = {
    partido_id: f.partido_id,
    ejercicio,
    materia: f.materia,
    resumen: f.resumen,
    pagina: f.pagina,
    documento_id: porUrl.get(f.fuente_url),
    confianza: 'transcrito'
  };
  if (f.apartado) fila.apartado = f.apartado;
  if (f.importe != null) fila.importe = f.importe;
  return fila;
});

const sinDocumento = aEscribir.filter(f => !f.documento_id).length;
if (sinDocumento) {
  console.log(`\n${sinDocumento} reparo(s) sin documento. No se ha cargado nada.\n`);
  process.exit(1);
}

const { error: eBorrar } = await db().from('hallazgo_fiscalizacion').delete().eq('ejercicio', ejercicio);
if (eBorrar) throw eBorrar;

const { error: eInsertar } = await db().from('hallazgo_fiscalizacion').insert(aEscribir);
if (eInsertar) {
  console.log(`\nERROR al insertar: ${eInsertar.message}`);
  console.log(`El ejercicio ${ejercicio} ha quedado vacio. Corrige y vuelve a lanzar con --publicar.\n`);
  process.exit(1);
}

console.log(`\nCargado: ejercicio ${ejercicio} reemplazado con ${aEscribir.length} reparos.`);
console.log('Refresca la portada: el hallazgo sale solo si hay tres partidos o mas.\n');
