import { readFileSync, existsSync } from 'node:fs';
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

const RUTA = opcion('fichero') || 'datos/externas/vdem.csv';
const COL_ELECCIONES = opcion('elecciones') || 'v2x_polyarchy';
const COL_CONTRAPESOS = opcion('contrapesos') || 'v2x_liberal';
const DESDE = Number(opcion('desde') ?? '') || 1789;
const FUENTE = 'vdem';
const seco = bandera('seco');
const verificar = bandera('verificar');
const publicar = bandera('publicar');

function detectarDelimitador(linea: string): string {
  let mejor = ',';
  let max = -1;
  for (const d of [',', ';', '\t', '|']) {
    let cuenta = 0;
    let comillas = false;
    for (const c of linea) {
      if (c === '"') comillas = !comillas;
      else if (c === d && !comillas) cuenta++;
    }
    if (cuenta > max) { max = cuenta; mejor = d; }
  }
  return mejor;
}

function partirCSV(texto: string, delimitador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  const limpio = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; }
        else comillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') comillas = true;
    else if (c === delimitador) { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); campo = ''; filas.push(fila); fila = []; }
    else if (c !== '\r') campo += c;
  }
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(v => v.trim() !== ''));
}

interface Fila {
  pais_codigo: string;
  pais_nombre: string;
  anio: number;
  elecciones: number | null;
  contrapesos: number | null;
}

async function leer(): Promise<Fila[]> {
  if (!existsSync(RUTA)) {
    console.error(`\nNo existe ${RUTA}.`);
    console.error('Descarga Country-Year: V-Dem Full+Others o V-Dem Core desde v-dem.net,');
    console.error('guardalo ahi, o pasa otra ruta con --fichero.\n');
    process.exit(1);
  }

  const texto = readFileSync(RUTA, 'utf8');
  const delim = detectarDelimitador(texto.split('\n', 1)[0] ?? '');
  const crudo = partirCSV(texto, delim);
  const cabeceras = crudo[0].map(c => c.trim());

  const idx = (nombres: string[]) => {
    for (const n of nombres) {
      const i = cabeceras.findIndex(c => c.toLowerCase() === n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };

  const iNombre = idx(['country_name']);
  const iCodigo = idx(['country_text_id']);
  const iAnio = idx(['year']);
  const iEle = idx([COL_ELECCIONES]);
  const iCon = idx([COL_CONTRAPESOS]);

  const faltan: string[] = [];
  if (iNombre < 0) faltan.push('country_name');
  if (iCodigo < 0) faltan.push('country_text_id');
  if (iAnio < 0) faltan.push('year');
  if (iEle < 0) faltan.push(COL_ELECCIONES);
  if (iCon < 0) faltan.push(COL_CONTRAPESOS);

  if (faltan.length) {
    console.error(`\nColumnas que faltan en ${RUTA}:`);
    faltan.forEach(f => console.error(`  - ${f}`));
    const disponibles = cabeceras.filter(c => /^v2x_/i.test(c)).sort();
    console.error(`\nIndices v2x_ que si estan en el fichero (${disponibles.length}):`);
    console.error(`  ${disponibles.join(', ') || 'ninguno'}`);
    console.error('\nSi tu descarga es Core y no trae el componente liberal, baja Full+Others,');
    console.error('o pasa otro indice con --contrapesos <columna>.\n');
    process.exit(1);
  }

  const salida: Fila[] = [];
  for (let f = 1; f < crudo.length; f++) {
    const fila = crudo[f];
    const anio = Number((fila[iAnio] ?? '').trim());
    if (!Number.isFinite(anio) || anio < DESDE) continue;
    const codigo = (fila[iCodigo] ?? '').trim();
    const nombre = (fila[iNombre] ?? '').trim();
    if (!codigo || !nombre) continue;
    const ele = Number((fila[iEle] ?? '').trim());
    const con = Number((fila[iCon] ?? '').trim());
    if (!Number.isFinite(ele) && !Number.isFinite(con)) continue;
    salida.push({
      pais_codigo: codigo,
      pais_nombre: nombre,
      anio,
      elecciones: Number.isFinite(ele) ? ele : null,
      contrapesos: Number.isFinite(con) ? con : null
    });
  }
  return salida;
}

function informar(filas: Fila[]) {
  const paises = new Set(filas.map(f => f.pais_codigo));
  const anios = filas.map(f => f.anio);
  console.log(`\nFichero:      ${RUTA}`);
  console.log(`Elecciones:   ${COL_ELECCIONES}`);
  console.log(`Contrapesos:  ${COL_CONTRAPESOS}`);
  console.log(`Filas:        ${filas.length}`);
  console.log(`Paises:       ${paises.size}`);
  console.log(`Periodo:      ${Math.min(...anios)} a ${Math.max(...anios)}\n`);
}

function polos(filas: Fila[]) {
  const ultimo = new Map<string, Fila>();
  for (const f of filas) {
    const previo = ultimo.get(f.pais_codigo);
    if (!previo || f.anio > previo.anio) ultimo.set(f.pais_codigo, f);
  }
  const lista = Array.from(ultimo.values());

  for (const [titulo, clave] of [['ELECCIONES', 'elecciones'], ['CONTRAPESOS', 'contrapesos']] as const) {
    const con = lista.filter(f => f[clave] !== null)
      .sort((a, b) => Number(a[clave]) - Number(b[clave]));
    if (!con.length) continue;
    const columna = clave === 'elecciones' ? COL_ELECCIONES : COL_CONTRAPESOS;
    console.log(`${titulo}  (${columna})`);
    console.log('  minimos, deberian ser autocracias cerradas:');
    con.slice(0, 5).forEach(f =>
      console.log(`    ${f.pais_nombre.padEnd(28)} ${Number(f[clave]).toFixed(3)}  (${f.anio})`));
    console.log('  maximos, deberian ser democracias consolidadas:');
    con.slice(-5).reverse().forEach(f =>
      console.log(`    ${f.pais_nombre.padEnd(28)} ${Number(f[clave]).toFixed(3)}  (${f.anio})`));
    console.log('');
  }

  const tope = Math.max(...lista.map(f => f.anio));
  const extintos = lista.filter(f => f.anio < tope - 2).sort((a, b) => a.anio - b.anio);
  if (extintos.length) {
    console.log(`ENTIDADES SIN DATO RECIENTE: ${extintos.length} de ${lista.length}`);
    console.log(`  Su ultimo anio es anterior a ${tope - 2}. Son entidades historicas que`);
    console.log('  dejaron de existir. NO pueden salir en el mapa del presente:');
    extintos.slice(0, 8).forEach(f =>
      console.log(`    ${f.pais_nombre.padEnd(28)} ultimo dato ${f.anio}`));
    if (extintos.length > 8) console.log(`    y ${extintos.length - 8} mas`);
    console.log('');
  }

  const espana = filas.filter(f => f.pais_codigo === 'ESP')
    .sort((a, b) => a.anio - b.anio);
  if (espana.length) {
    console.log('ESPANA, control de sentido:');
    for (const anio of [1936, 1955, 1975, 1978, 1982, 2000, 2020]) {
      const f = espana.find(x => x.anio === anio);
      if (!f) continue;
      console.log(`    ${anio}   elecciones ${f.elecciones === null ? '   -  ' : Number(f.elecciones).toFixed(3)}` +
        `   contrapesos ${f.contrapesos === null ? '   -  ' : Number(f.contrapesos).toFixed(3)}`);
    }
    console.log('');
    console.log('La senal que confirma la orientacion es el salto de la Transicion: 1975 bajo,');
    console.log('1978 y 1982 altos en las dos columnas. Bajo el franquismo las elecciones tienen');
    console.log('que estar cerca de 0; los contrapesos salen bajos pero no nulos, porque ese');
    console.log('indice mide limites al ejecutivo y legalidad formal, no competencia electoral.');
    console.log('Si la Transicion no sube, la orientacion esta invertida.\n');
  }
}

if (publicar) {
  const { error } = await db()
    .from('paises_democracia')
    .update({ publicado: true })
    .eq('fuente_id', FUENTE);
  if (error) throw error;
  const { count } = await db()
    .from('paises_democracia')
    .select('*', { count: 'exact', head: true })
    .eq('fuente_id', FUENTE)
    .eq('publicado', true);
  console.log(`\nPublicadas ${count ?? 0} filas de ${FUENTE}.\n`);
  process.exit(0);
}

const filas = await leer();
informar(filas);
polos(filas);

if (verificar) {
  console.log('Modo verificar: no se ha escrito nada.');
  console.log('Comprueba los polos de arriba antes de cargar.\n');
  process.exit(0);
}

if (seco) {
  console.log('Modo seco: no se ha escrito nada.\n');
  process.exit(0);
}

const { error: eFuente } = await db().from('fuentes_externas').upsert({
  id: FUENTE,
  nombre: 'V-Dem (Varieties of Democracy)',
  institucion: 'V-Dem Institute, University of Gothenburg',
  tipo: 'encuesta_expertos',
  url: 'https://www.v-dem.net',
  licencia: 'Creative Commons Atribucion-CompartirIgual 4.0',
  cita: 'Coppedge, M. et al. V-Dem Country-Year Dataset. V-Dem Institute, University of Gothenburg',
  ola: opcion('ola') || null,
  actualizado_en: new Date().toISOString()
}, { onConflict: 'id' });
if (eFuente) throw eFuente;

const version = `${FUENTE}-democracia-${new Date().toISOString().slice(0, 10)}`;
const registros = filas.map(f => ({
  pais_codigo: f.pais_codigo,
  pais_nombre: f.pais_nombre,
  anio: f.anio,
  fuente_id: FUENTE,
  indicador_elecciones: COL_ELECCIONES,
  indicador_contrapesos: COL_CONTRAPESOS,
  elecciones: f.elecciones,
  contrapesos: f.contrapesos,
  publicado: false,
  version_carga: version
}));

let escritas = 0;
for (let i = 0; i < registros.length; i += 1000) {
  const lote = registros.slice(i, i + 1000);
  const { error } = await db()
    .from('paises_democracia')
    .upsert(lote, { onConflict: 'pais_codigo,anio,fuente_id' });
  if (error) throw error;
  escritas += lote.length;
  if (escritas % 10000 === 0 || escritas === registros.length) {
    console.log(`  ${escritas}/${registros.length}`);
  }
}

console.log(`\nFilas escritas: ${escritas}`);
console.log(`Version:        ${version}`);
console.log('\nTodo entra con publicado = false.');
console.log('Comprueba los polos con --verificar y luego publica con --publicar.\n');