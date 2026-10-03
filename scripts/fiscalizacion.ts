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

const GRAVEDADES = ['infraccion', 'incumplimiento', 'contable'];
const OPINIONES = ['favorable', 'con_salvedades', 'desfavorable', 'denegada'];

const CABECERA = ['partido', 'ejercicio', 'apartado', 'materia', 'gravedad', 'resumen', 'importe', 'fuente_url', 'pagina', 'modelo', 'nota', 'nota_url'];
const OPCIONALES = ['modelo', 'nota', 'nota_url'];
const OBLIGATORIAS = CABECERA.filter(c => !OPCIONALES.includes(c));
const CABECERA_OPINION = ['partido', 'ejercicio', 'opinion', 'salvedades', 'limitacion_alcance', 'fuente_url', 'pagina'];
const CARPETA = 'datos/fiscalizacion';
const LARGO_MAXIMO = 220;
const LARGO_APARTADO = 80;
const LARGO_NOTA = 300;

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
const rutaOpiniones = join(CARPETA, `${ejercicio}-opiniones.csv`);

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

function leerCSV(rutaCSV: string, obligatorias: string[]) {
  const crudo = partirCSV(readFileSync(rutaCSV, 'utf8').replace(/^﻿/, ''));
  if (crudo.length === 0) {
    console.log(`\n${rutaCSV} esta vacio.\n`);
    process.exit(1);
  }
  const cabecera = crudo[0].map(c => c.trim());
  const faltan = obligatorias.filter(c => !cabecera.includes(c));
  if (faltan.length) {
    console.log(`\nFaltan columnas en ${rutaCSV}: ${faltan.join(', ')}\n`);
    process.exit(1);
  }
  const col = (fila: string[], nombre: string) => {
    const i = cabecera.indexOf(nombre);
    return i === -1 ? '' : (fila[i] ?? '').trim();
  };
  return { filas: crudo.slice(1), col };
}

function paginaValida(pagina: string) {
  return pagina !== '' && Number.isInteger(Number(pagina)) && Number(pagina) >= 1;
}

if (plantilla) {
  mkdirSync(CARPETA, { recursive: true });
  let creados = 0;
  for (const [destino, cabecera] of [[ruta, CABECERA], [rutaOpiniones, CABECERA_OPINION]] as const) {
    if (existsSync(destino)) {
      console.log(`\n${destino} ya existe. Borralo a mano si quieres regenerarlo.`);
      continue;
    }
    writeFileSync(destino, cabecera.join(',') + '\n', 'utf8');
    creados++;
    console.log(`\n${destino} creado.`);
  }
  console.log(`\n${ruta}: una fila por reparo del informe.`);
  console.log('  apartado: seccion del informe, unica por partido. Ejemplo: II.25 C.2.a');
  console.log(`  materia: ${MATERIAS.join(', ')}.`);
  console.log('  gravedad: infraccion si el Tribunal dice que podria ser una infraccion sancionable; incumplimiento si dice que incumple una ley; contable en el resto.');
  console.log(`  resumen: frase en lenguaje llano que empieza por verbo, de ${LARGO_MAXIMO} caracteres como mucho.`);
  console.log('  importe: euros con punto decimal y sin separador de miles. Vacio si el reparo no tiene cifra.');
  console.log('  pagina: la numerada en el informe. Obligatoria.');
  console.log('  modelo: vacio si lo has transcrito tu; el nombre del modelo si lo ha extraido una IA.');
  console.log(`  nota y nota_url: opcionales, para algo que paso despues del informe (una multa, una sentencia). La nota lleva siempre su fuente; ${LARGO_NOTA} caracteres como mucho.`);
  console.log(`\n${rutaOpiniones}: una fila por partido con la opinion del Tribunal sobre sus cuentas.`);
  console.log(`  opinion: ${OPINIONES.join(', ')}.`);
  console.log('  salvedades: numero de salvedades de la opinion. limitacion_alcance: si o no.\n');
  process.exit(creados ? 0 : 1);
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

const problemas: string[] = [];
const filas: any[] = [];
const opiniones: any[] = [];

{
  const { filas: crudo, col } = leerCSV(ruta, OBLIGATORIAS);
  const apartados = new Set<string>();
  crudo.forEach((f, i) => {
    const n = i + 2;
    const p = porClave.get(col(f, 'partido').toLowerCase());
    const ej = Number(col(f, 'ejercicio'));
    const apartado = col(f, 'apartado').replace(/\s+/g, ' ');
    const materia = col(f, 'materia');
    const gravedad = col(f, 'gravedad');
    const resumen = col(f, 'resumen').replace(/\s+/g, ' ');
    const bruto = col(f, 'importe');
    const url = col(f, 'fuente_url');
    const pagina = col(f, 'pagina');
    const modelo = col(f, 'modelo');
    const nota = col(f, 'nota').replace(/\s+/g, ' ');
    const notaUrl = col(f, 'nota_url');

    if (!p) { problemas.push(`${ruta} fila ${n}: "${col(f, 'partido')}" no es ningun partido`); return; }
    if (ej !== ejercicio) { problemas.push(`${ruta} fila ${n}: ejercicio ${col(f, 'ejercicio')} no es ${ejercicio}`); return; }
    if (!apartado) { problemas.push(`${ruta} fila ${n}: falta el apartado`); return; }
    if (apartado.length > LARGO_APARTADO) { problemas.push(`${ruta} fila ${n}: apartado de ${apartado.length} caracteres, el maximo es ${LARGO_APARTADO}`); return; }
    if (!MATERIAS.includes(materia)) { problemas.push(`${ruta} fila ${n}: materia "${materia}" no valida`); return; }
    if (!GRAVEDADES.includes(gravedad)) { problemas.push(`${ruta} fila ${n}: gravedad "${gravedad}" no valida (${GRAVEDADES.join(', ')})`); return; }
    if (!resumen) { problemas.push(`${ruta} fila ${n}: resumen vacio`); return; }
    if (resumen.length > LARGO_MAXIMO) { problemas.push(`${ruta} fila ${n}: resumen de ${resumen.length} caracteres, el maximo es ${LARGO_MAXIMO}`); return; }
    if (/\.\.\.|…/.test(resumen)) { problemas.push(`${ruta} fila ${n}: el resumen lleva puntos suspensivos; escribelo entero`); return; }

    let importe: number | null = null;
    if (bruto !== '') {
      importe = Number(bruto.replace(/\s/g, ''));
      if (!Number.isFinite(importe)) { problemas.push(`${ruta} fila ${n}: importe "${bruto}" no es un numero`); return; }
      if (importe < 0) { problemas.push(`${ruta} fila ${n}: importe negativo`); return; }
    }

    const urlMal = motivoUrlInvalida(url);
    if (urlMal) { problemas.push(`${ruta} fila ${n}: fuente_url ${urlMal}`); return; }
    if (!paginaValida(pagina)) { problemas.push(`${ruta} fila ${n}: pagina "${pagina}" no vale. Es obligatoria y va en numero entero`); return; }
    if (nota && !notaUrl) { problemas.push(`${ruta} fila ${n}: la nota no tiene nota_url; toda nota lleva su fuente`); return; }
    if (notaUrl && !nota) { problemas.push(`${ruta} fila ${n}: hay nota_url pero no nota`); return; }
    if (nota.length > LARGO_NOTA) { problemas.push(`${ruta} fila ${n}: nota de ${nota.length} caracteres, el maximo es ${LARGO_NOTA}`); return; }
    if (notaUrl) {
      const notaMal = motivoUrlInvalida(notaUrl);
      if (notaMal) { problemas.push(`${ruta} fila ${n}: nota_url ${notaMal}`); return; }
    }

    const llave = `${p.id}:${apartado.toLowerCase()}`;
    if (apartados.has(llave)) { problemas.push(`${ruta} fila ${n}: apartado "${apartado}" repetido en ${p.slug}`); return; }
    apartados.add(llave);

    filas.push({
      partido_id: p.id,
      siglas: p.siglas ?? p.slug,
      apartado,
      materia,
      gravedad,
      resumen,
      importe,
      pagina: Number(pagina),
      fuente_url: url,
      modelo,
      nota,
      notaUrl
    });
  });
}

if (existsSync(rutaOpiniones)) {
  const { filas: crudo, col } = leerCSV(rutaOpiniones, CABECERA_OPINION);
  const vistos = new Set<string>();
  crudo.forEach((f, i) => {
    const n = i + 2;
    const p = porClave.get(col(f, 'partido').toLowerCase());
    const ej = Number(col(f, 'ejercicio'));
    const opinion = col(f, 'opinion');
    const salvedades = col(f, 'salvedades');
    const limitacion = col(f, 'limitacion_alcance').toLowerCase();
    const url = col(f, 'fuente_url');
    const pagina = col(f, 'pagina');

    if (!p) { problemas.push(`${rutaOpiniones} fila ${n}: "${col(f, 'partido')}" no es ningun partido`); return; }
    if (ej !== ejercicio) { problemas.push(`${rutaOpiniones} fila ${n}: ejercicio ${col(f, 'ejercicio')} no es ${ejercicio}`); return; }
    if (!OPINIONES.includes(opinion)) { problemas.push(`${rutaOpiniones} fila ${n}: opinion "${opinion}" no valida (${OPINIONES.join(', ')})`); return; }
    if (!/^\d+$/.test(salvedades)) { problemas.push(`${rutaOpiniones} fila ${n}: salvedades "${salvedades}" no es un numero entero`); return; }
    if (opinion === 'favorable' && Number(salvedades) > 0) { problemas.push(`${rutaOpiniones} fila ${n}: una opinion favorable no lleva salvedades`); return; }
    if (opinion === 'con_salvedades' && Number(salvedades) === 0) { problemas.push(`${rutaOpiniones} fila ${n}: con_salvedades necesita al menos una salvedad`); return; }
    if (limitacion !== 'si' && limitacion !== 'no') { problemas.push(`${rutaOpiniones} fila ${n}: limitacion_alcance "${limitacion}" debe ser si o no`); return; }
    const urlMal = motivoUrlInvalida(url);
    if (urlMal) { problemas.push(`${rutaOpiniones} fila ${n}: fuente_url ${urlMal}`); return; }
    if (!paginaValida(pagina)) { problemas.push(`${rutaOpiniones} fila ${n}: pagina "${pagina}" no vale. Es obligatoria y va en numero entero`); return; }
    if (vistos.has(p.id)) { problemas.push(`${rutaOpiniones} fila ${n}: ${p.slug} repetido`); return; }
    vistos.add(p.id);

    opiniones.push({
      partido_id: p.id,
      siglas: p.siglas ?? p.slug,
      opinion,
      salvedades: Number(salvedades),
      limitacion_alcance: limitacion === 'si',
      pagina: Number(pagina),
      fuente_url: url
    });
  });
}

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s). No se ha escrito nada:\n`);
  for (const p of problemas) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}

if (filas.length === 0) {
  console.log(`\n${ruta} no tiene ningun reparo.\n`);
  process.exit(1);
}

const porPartido = new Map<string, { n: number; infraccion: number; incumplimiento: number }>();
for (const f of filas) {
  const a = porPartido.get(f.siglas) ?? { n: 0, infraccion: 0, incumplimiento: 0 };
  a.n += 1;
  if (f.gravedad === 'infraccion') a.infraccion += 1;
  if (f.gravedad === 'incumplimiento') a.incumplimiento += 1;
  porPartido.set(f.siglas, a);
}
const opinionDe = new Map(opiniones.map(o => [o.siglas, o]));

console.log(`\n${ruta}: ${filas.length} reparos de ${porPartido.size} partidos`);
for (const [siglas, a] of [...porPartido.entries()].sort((x, y) => y[1].infraccion - x[1].infraccion || y[1].incumplimiento - x[1].incumplimiento || y[1].n - x[1].n)) {
  const o = opinionDe.get(siglas);
  const opinion = o ? `${o.opinion.replace('_', ' ')}${o.salvedades ? ` (${o.salvedades})` : ''}${o.limitacion_alcance ? ', limitacion al alcance' : ''}` : 'sin opinion';
  console.log(`  ${siglas.padEnd(12)} ${String(a.n).padStart(3)} reparo${a.n === 1 ? ' ' : 's'}   infracciones ${a.infraccion}   incumplimientos ${String(a.incumplimiento).padStart(2)}   ${opinion}`);
}
if (!existsSync(rutaOpiniones)) {
  console.log(`\n  Aviso: no existe ${rutaOpiniones}; se cargan solo los reparos.`);
} else {
  const sinOpinion = [...porPartido.keys()].filter(s => !opinionDe.has(s));
  if (sinOpinion.length) console.log(`\n  Aviso: sin opinion del Tribunal para ${sinOpinion.join(', ')}.`);
}
const conNota = filas.filter(f => f.nota).length;
if (conNota) console.log(`\n  ${conNota} reparo(s) con nota sobre lo que paso despues del informe.`);

const urls = Array.from(new Set([...filas, ...opiniones].map(f => f.fuente_url)));
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

const { error: eColumnas } = await db().from('hallazgo_fiscalizacion').select('gravedad, apartado, leido_at, nota, nota_url').limit(1);
if (eColumnas) {
  console.log(`\nERROR: a hallazgo_fiscalizacion le faltan columnas nuevas (${eColumnas.message}).`);
  console.log('Corre antes el SQL de la migracion. No se ha tocado nada.\n');
  process.exit(1);
}
if (opiniones.length) {
  const { error: eTabla } = await db().from('opinion_fiscalizacion').select('partido_id').limit(1);
  if (eTabla) {
    console.log(`\nERROR: no existe la tabla opinion_fiscalizacion (${eTabla.message}).`);
    console.log('Corre antes el SQL de la migracion. No se ha tocado nada.\n');
    process.exit(1);
  }
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

const leidoAt = new Date().toISOString();

const aEscribir = filas.map(f => {
  const fila: Record<string, unknown> = {
    partido_id: f.partido_id,
    ejercicio,
    apartado: f.apartado,
    materia: f.materia,
    gravedad: f.gravedad,
    resumen: f.resumen,
    pagina: f.pagina,
    documento_id: porUrl.get(f.fuente_url),
    confianza: f.modelo ? 'comprobado' : 'transcrito',
    leido_at: leidoAt
  };
  if (f.importe != null) fila.importe = f.importe;
  if (f.modelo) fila.modelo = f.modelo;
  if (f.nota) {
    fila.nota = f.nota;
    fila.nota_url = f.notaUrl;
  }
  return fila;
});

const opinionesAEscribir = opiniones.map(o => ({
  partido_id: o.partido_id,
  ejercicio,
  opinion: o.opinion,
  salvedades: o.salvedades,
  limitacion_alcance: o.limitacion_alcance,
  pagina: o.pagina,
  documento_id: porUrl.get(o.fuente_url),
  leido_at: leidoAt
}));

const sinDocumento = [...aEscribir, ...opinionesAEscribir].filter(f => !f.documento_id).length;
if (sinDocumento) {
  console.log(`\n${sinDocumento} fila(s) sin documento. No se ha cargado nada.\n`);
  process.exit(1);
}

const { error: eBorrar } = await db().from('hallazgo_fiscalizacion').delete().eq('ejercicio', ejercicio);
if (eBorrar) throw eBorrar;

const { error: eInsertar } = await db().from('hallazgo_fiscalizacion').insert(aEscribir);
if (eInsertar) {
  console.log(`\nERROR al insertar reparos: ${eInsertar.message}`);
  console.log(`El ejercicio ${ejercicio} ha quedado vacio. Corrige y vuelve a lanzar con --publicar.\n`);
  process.exit(1);
}
console.log(`\nCargado: ejercicio ${ejercicio} reemplazado con ${aEscribir.length} reparos.`);

if (opinionesAEscribir.length) {
  const { error: eBorrarOp } = await db().from('opinion_fiscalizacion').delete().eq('ejercicio', ejercicio);
  if (eBorrarOp) throw eBorrarOp;
  const { error: eInsertarOp } = await db().from('opinion_fiscalizacion').insert(opinionesAEscribir);
  if (eInsertarOp) {
    console.log(`\nERROR al insertar opiniones: ${eInsertarOp.message}`);
    console.log(`Las opiniones de ${ejercicio} han quedado vacias. Corrige y vuelve a lanzar con --publicar.\n`);
    process.exit(1);
  }
  console.log(`Cargado: ${opinionesAEscribir.length} opiniones del Tribunal.`);
}

console.log('Refresca la web: en Partidos, cada partido muestra a la derecha los reparos del Tribunal.\n');
