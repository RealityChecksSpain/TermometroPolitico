import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';

exigirEnv('SUPABASE_URL');
exigirEnv('SUPABASE_SERVICE_ROLE_KEY');

const args = process.argv.slice(2);
const bandera = (n: string) => args.includes(`--${n}`);
const opcion = (n: string) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
};

const ESTADOS = ['publicado', 'parcial', 'ausente', 'no_verificable'];
const CABECERAS = [
  'tipo_sujeto', 'clave', 'nombre', 'web_oficial', 'ejercicio', 'obligacion',
  'articulo', 'exigencia', 'descripcion',
  'estado', 'url', 'nota', 'fecha_consulta'
];

const plantilla = bandera('plantilla');
const publicar = bandera('publicar');
const estado = bandera('estado');
const ejercicio = Number(opcion('ejercicio') ?? '') || 0;
const ruta = opcion('fichero') || (ejercicio ? `datos/transparencia/${ejercicio}.csv` : '');

function comillar(v: string): string {
  if (v === '') return '';
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function partirCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else comillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { comillas = true; continue; }
    if (c === ',') { fila.push(campo); campo = ''; continue; }
    if (c === '\n') {
      fila.push(campo.replace(/\r$/, ''));
      if (fila.some(x => x.trim() !== '')) filas.push(fila);
      fila = []; campo = '';
      continue;
    }
    campo += c;
  }
  fila.push(campo.replace(/\r$/, ''));
  if (fila.some(x => x.trim() !== '')) filas.push(fila);
  return filas;
}

async function traerCatalogos() {
  const [obl, par, fun] = await Promise.all([
    db().from('transparencia_obligacion').select('*').order('sujeto').order('orden'),
    db().from('partidos').select('*'),
    db().from('fundaciones').select('id, nombre, activa')
  ]);
  if (obl.error) throw new Error(`transparencia_obligacion: ${obl.error.message}`);
  if (par.error) throw new Error(`partidos: ${par.error.message}`);
  if (fun.error) throw new Error(`fundaciones: ${fun.error.message}`);
  return {
    obligaciones: obl.data ?? [],
    partidos: par.data ?? [],
    fundaciones: (fun.data ?? []).filter((f: any) => f.activa !== false)
  };
}

if (estado) {
  const { data, error } = await db()
    .from('v_transparencia_resumen')
    .select('*')
    .order('ejercicio', { ascending: false })
    .order('siglas');
  if (error) { console.error(`\nNo se puede leer v_transparencia_resumen: ${error.message}\n`); process.exit(1); }
  if (!data?.length) { console.log('\nSin comprobaciones cargadas todavia.\n'); process.exit(0); }
  console.log('');
  for (const f of data as any[]) {
    const pendientes = Number(f.obligaciones_en_la_ley) - Number(f.comprobadas);
    console.log(
      `  ${String(f.ejercicio)}  ${String(f.siglas).padEnd(14)}` +
      `publicadas ${String(f.publicadas).padStart(2)}/${f.obligaciones_en_la_ley}  ` +
      `parcial ${f.parciales}  ausente ${f.ausentes}  sin verificar ${f.no_verificables}` +
      (pendientes > 0 ? `  [${pendientes} sin comprobar]` : '')
    );
  }
  console.log('');
  process.exit(0);
}

if (plantilla) {
  if (!ejercicio) {
    console.error('\nFalta --ejercicio. Ejemplo: npm run transparencia:plantilla -- --ejercicio 2024\n');
    process.exit(1);
  }
  const { obligaciones, partidos, fundaciones } = await traerCatalogos();
  if (!obligaciones.length) {
    console.error('\ntransparencia_obligacion esta vacia. Lanza antes la migracion.\n');
    process.exit(1);
  }

  const lineas: string[] = [CABECERAS.join(',')];
  const hoy = new Date().toISOString().slice(0, 10);

  const conWeb = (partidos as any[]).filter(p => String(p.web ?? '').trim() !== '');
  const sinWeb = (partidos as any[]).filter(p => String(p.web ?? '').trim() === '');
  const fundConWeb = (fundaciones as any[]).filter(f => String(f.web ?? '').trim() !== '');
  const fundSinWeb = (fundaciones as any[]).filter(f => String(f.web ?? '').trim() === '');

  for (const p of conWeb) {
    for (const o of obligaciones.filter((x: any) => x.sujeto === 'partido')) {
      lineas.push([
        'partido', p.slug, p.siglas ?? p.nombre ?? '', p.web, String(ejercicio), o.codigo,
        o.articulo, o.exigencia, o.descripcion, '', '', '', hoy
      ].map(comillar).join(','));
    }
  }
  for (const f of fundConWeb) {
    for (const o of obligaciones.filter((x: any) => x.sujeto === 'fundacion')) {
      lineas.push([
        'fundacion', f.nombre, f.nombre, f.web, String(ejercicio), o.codigo,
        o.articulo, o.exigencia, o.descripcion, '', '', '', hoy
      ].map(comillar).join(','));
    }
  }

  const destino = ruta || `datos/transparencia/${ejercicio}.csv`;
  if (existsSync(destino)) {
    console.error(`\n${destino} ya existe. No lo sobrescribo.`);
    console.error('Borralo a mano si quieres regenerarlo, o pasa otra ruta con --fichero.\n');
    process.exit(1);
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, lineas.join('\n') + '\n', 'utf8');

  console.log(`\n${destino}`);
  console.log(`  ${conWeb.length} partidos x ${obligaciones.filter((o: any) => o.sujeto === 'partido').length} obligaciones`);
  console.log(`  ${fundConWeb.length} fundaciones x ${obligaciones.filter((o: any) => o.sujeto === 'fundacion').length} obligaciones`);
  console.log(`  ${lineas.length - 1} filas por rellenar\n`);

  if (sinWeb.length || fundSinWeb.length) {
    console.log('  Fuera de la plantilla por no tener web registrada:');
    for (const p of sinWeb) console.log(`    partido    ${p.slug}`);
    for (const f of fundSinWeb) console.log(`    fundacion  ${f.nombre}`);
    console.log('');
    console.log('  Si alguno si es un partido que publica, ponle la web en la tabla partidos');
    console.log('  y vuelve a generar la plantilla. Los grupos parlamentarios no son partidos');
    console.log('  y no tienen obligaciones de publicidad activa: dejalos fuera.\n');
  }
  console.log('  Rellena estado y url en cada fila. Estados validos:');
  console.log(`    ${ESTADOS.join(', ')}`);
  console.log('  nota es obligatoria si el estado es parcial o no_verificable.');
  console.log('  url es siempre la pagina que miraste, tambien cuando no esta publicado.\n');
  process.exit(0);
}

if (!ruta) {
  console.error('\nFalta --ejercicio o --fichero.\n');
  console.error('  npm run transparencia:plantilla -- --ejercicio 2024');
  console.error('  npm run transparencia -- --ejercicio 2024');
  console.error('  npm run transparencia -- --ejercicio 2024 --publicar');
  console.error('  npm run transparencia:estado\n');
  process.exit(1);
}

if (!existsSync(ruta)) {
  console.error(`\nNo existe ${ruta}. Generalo primero con --plantilla.\n`);
  process.exit(1);
}

const { obligaciones, partidos, fundaciones } = await traerCatalogos();
const porCodigo = new Map(obligaciones.map((o: any) => [o.codigo, o]));
const porSlug = new Map<string, any>();
for (const p of partidos as any[]) {
  if (p.slug) porSlug.set(String(p.slug).toLowerCase(), p);
  if (p.siglas) porSlug.set(String(p.siglas).toLowerCase(), p);
}
const porNombre = new Map<string, any>();
for (const f of fundaciones as any[]) porNombre.set(String(f.nombre).toLowerCase(), f);

const crudo = partirCSV(readFileSync(ruta, 'utf8'));
const cabeceras = (crudo[0] ?? []).map(c => c.trim());
const col = (n: string) => cabeceras.findIndex(c => c.toLowerCase() === n);

const obligatorias = ['tipo_sujeto', 'clave', 'ejercicio', 'obligacion', 'estado', 'url', 'fecha_consulta'];
const faltan = obligatorias.filter(c => col(c) < 0);
if (faltan.length) {
  console.error(`\nFaltan columnas en ${ruta}: ${faltan.join(', ')}\n`);
  process.exit(1);
}

const iTipo = col('tipo_sujeto');
const iClave = col('clave');
const iEjercicio = col('ejercicio');
const iObligacion = col('obligacion');
const iEstado = col('estado');
const iUrl = col('url');
const iNota = col('nota');
const iFecha = col('fecha_consulta');

const problemas: string[] = [];
const vistas = new Set<string>();
const filas: any[] = [];
let vacias = 0;

for (let n = 1; n < crudo.length; n++) {
  const f = crudo[n];
  const linea = n + 1;
  const dato = (i: number) => (i >= 0 ? (f[i] ?? '').trim() : '');

  const tipo = dato(iTipo).toLowerCase();
  const clave = dato(iClave);
  const codigo = dato(iObligacion);
  const est = dato(iEstado).toLowerCase();
  const url = dato(iUrl);
  const nota = dato(iNota);
  const fecha = dato(iFecha);
  const ej = Number(dato(iEjercicio));

  if (!est) { vacias++; continue; }

  if (tipo !== 'partido' && tipo !== 'fundacion') {
    problemas.push(`linea ${linea}: tipo_sujeto "${tipo}" no es partido ni fundacion`);
    continue;
  }

  const obligacion = porCodigo.get(codigo);
  if (!obligacion) {
    problemas.push(`linea ${linea}: obligacion "${codigo}" no esta en transparencia_obligacion`);
    continue;
  }
  if (obligacion.sujeto !== tipo) {
    problemas.push(`linea ${linea}: "${codigo}" es de ${obligacion.sujeto} y la fila dice ${tipo}`);
    continue;
  }

  let partidoId: string | null = null;
  let fundacionId: string | null = null;
  if (tipo === 'partido') {
    const p = porSlug.get(clave.toLowerCase());
    if (!p) { problemas.push(`linea ${linea}: no hay partido con slug o siglas "${clave}"`); continue; }
    partidoId = p.id;
  } else {
    const fu = porNombre.get(clave.toLowerCase());
    if (!fu) { problemas.push(`linea ${linea}: no hay fundacion activa llamada "${clave}"`); continue; }
    fundacionId = fu.id;
  }

  if (!ESTADOS.includes(est)) {
    problemas.push(`linea ${linea}: estado "${est}" no es uno de ${ESTADOS.join(', ')}`);
    continue;
  }
  if (!Number.isInteger(ej) || ej < 2007 || ej > 2100) {
    problemas.push(`linea ${linea}: ejercicio "${dato(iEjercicio)}" no es un anio valido`);
    continue;
  }
  if (!/^https:\/\//.test(url)) {
    problemas.push(`linea ${linea}: url vacia o no https. Pon la pagina que miraste, tambien si no habia nada`);
    continue;
  }
  if ((est === 'parcial' || est === 'no_verificable') && !nota) {
    problemas.push(`linea ${linea}: estado ${est} exige nota explicando que encontraste`);
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    problemas.push(`linea ${linea}: fecha_consulta "${fecha}" no tiene formato AAAA-MM-DD`);
    continue;
  }

  const llave = `${tipo}:${clave.toLowerCase()}:${ej}:${codigo}`;
  if (vistas.has(llave)) {
    problemas.push(`linea ${linea}: repetida (${clave}, ${ej}, ${codigo})`);
    continue;
  }
  vistas.add(llave);

  filas.push({
    partido_id: partidoId,
    fundacion_id: fundacionId,
    ejercicio: ej,
    obligacion: codigo,
    estado: est,
    url,
    nota: nota || null,
    fecha_consulta: fecha
  });
}

const ejercicios = [...new Set(filas.map(f => f.ejercicio))];

console.log(`\n${ruta}`);
console.log(`  filas con estado    ${filas.length}`);
console.log(`  filas sin rellenar  ${vacias}`);
console.log(`  ejercicios          ${ejercicios.join(', ') || '-'}`);

const resumen = new Map<string, number>();
for (const f of filas) resumen.set(f.estado, (resumen.get(f.estado) ?? 0) + 1);
for (const e of ESTADOS) console.log(`  ${e.padEnd(16)}${resumen.get(e) ?? 0}`);

if (problemas.length) {
  console.error(`\n${problemas.length} problemas. No se escribe nada.\n`);
  for (const p of problemas) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}

if (!filas.length) {
  console.error('\nNinguna fila tiene estado. Rellena el fichero antes.\n');
  process.exit(1);
}

const esperadas = new Map<string, number>();
for (const f of filas) {
  const k = f.partido_id ? `p:${f.partido_id}:${f.ejercicio}` : `f:${f.fundacion_id}:${f.ejercicio}`;
  esperadas.set(k, (esperadas.get(k) ?? 0) + 1);
}
const totalPartido = obligaciones.filter((o: any) => o.sujeto === 'partido').length;
const totalFundacion = obligaciones.filter((o: any) => o.sujeto === 'fundacion').length;
const incompletos: string[] = [];
for (const [k, n] of esperadas) {
  const total = k.startsWith('p:') ? totalPartido : totalFundacion;
  if (n < total) incompletos.push(`${k} tiene ${n} de ${total}`);
}
if (incompletos.length) {
  console.log(`\n  Sujetos con comprobaciones a medias: ${incompletos.length}`);
  console.log('  El resumen mostrara el hueco, no lo rellenara.');
}

if (!publicar) {
  console.log('\nValidado. Nada escrito. Repite con --publicar para cargarlo.\n');
  process.exit(0);
}

for (const ej of ejercicios) {
  const { error, count } = await db()
    .from('transparencia_comprobacion')
    .delete({ count: 'exact' })
    .eq('ejercicio', ej);
  if (error) { console.error(`\nNo se pudo limpiar el ejercicio ${ej}: ${error.message}\n`); process.exit(1); }
  console.log(`\n  ejercicio ${ej}: borradas ${count ?? 0} filas anteriores`);
}

let escritas = 0;
for (let i = 0; i < filas.length; i += 200) {
  const lote = filas.slice(i, i + 200);
  const { error } = await db().from('transparencia_comprobacion').insert(lote);
  if (error) {
    console.error(`\nFallo insertando el lote que empieza en la fila ${i + 1}: ${error.message}`);
    console.error(`Escritas ${escritas} de ${filas.length}. El ejercicio queda a medias.\n`);
    process.exit(1);
  }
  escritas += lote.length;
}

console.log(`  insertadas ${escritas} filas\n`);