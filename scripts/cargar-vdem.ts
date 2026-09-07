import { readFileSync, existsSync } from 'node:fs';
import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { Regimen } from '../src/lib/prompt-regimenes';

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

const RUTA_VDEM = opcion('fichero') || 'datos/externas/vdem.csv';
const RUTA_REGIMENES = opcion('regimenes') || 'datos/regimenes/regimenes.json';
const INDICADOR = opcion('indicador') || 'v2x_libdem';
const FUENTE = 'vdem';
const seco = bandera('seco');

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

if (!existsSync(RUTA_VDEM)) {
  console.error(`\nNo existe ${RUTA_VDEM}.`);
  console.error('Descarga el fichero pais-anio de V-Dem (V-Dem-CY-Core) desde v-dem.net y guardalo ahi,');
  console.error('o pasa otra ruta con --fichero.\n');
  process.exit(1);
}

if (!existsSync(RUTA_REGIMENES)) {
  console.error(`\nNo existe ${RUTA_REGIMENES}.\n`);
  process.exit(1);
}

const regimenes: Regimen[] = JSON.parse(readFileSync(RUTA_REGIMENES, 'utf8'));

const texto = readFileSync(RUTA_VDEM, 'utf8');
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

const iPais = idx(['country_name']);
const iAnio = idx(['year']);
const iValor = idx([INDICADOR]);

if (iPais < 0 || iAnio < 0 || iValor < 0) {
  console.error('\nColumnas que faltan:');
  if (iPais < 0) console.error('  - country_name');
  if (iAnio < 0) console.error('  - year');
  if (iValor < 0) console.error(`  - ${INDICADOR}`);
  console.error(`\nPrimeras columnas del fichero:\n  ${cabeceras.slice(0, 30).join(', ')}\n`);
  process.exit(1);
}

console.log(`\nFichero:    ${RUTA_VDEM}`);
console.log(`Filas:      ${crudo.length - 1}`);
console.log(`Indicador:  ${INDICADOR}\n`);

interface Resumen {
  regimen: Regimen;
  valores: number[];
}

const porRegimen = new Map<string, Resumen>();
for (const r of regimenes) porRegimen.set(r.clave, { regimen: r, valores: [] });

for (let f = 1; f < crudo.length; f++) {
  const fila = crudo[f];
  const pais = (fila[iPais] ?? '').trim();
  const anio = Number((fila[iAnio] ?? '').trim());
  const valor = Number((fila[iValor] ?? '').trim());
  if (!pais || !Number.isFinite(anio) || !Number.isFinite(valor)) continue;
  for (const r of porRegimen.values()) {
    if (r.regimen.pais_vdem.toLowerCase() !== pais.toLowerCase()) continue;
    if (anio < r.regimen.desde || anio > r.regimen.hasta) continue;
    r.valores.push(valor);
  }
}

const listos = Array.from(porRegimen.values()).filter(r => r.valores.length > 0);
const vacios = Array.from(porRegimen.values()).filter(r => r.valores.length === 0);

for (const r of listos) {
  const m = r.valores.reduce((a, b) => a + b, 0) / r.valores.length;
  console.log(`  ${r.regimen.nombre_corto.padEnd(22)} ${m.toFixed(3)}   ${r.valores.length} anios`);
}
for (const r of vacios) {
  console.log(`  ${r.regimen.nombre_corto.padEnd(22)} SIN DATOS  (pais_vdem "${r.regimen.pais_vdem}", ${r.regimen.desde}-${r.regimen.hasta})`);
}
console.log('');

if (vacios.length) {
  console.log('Los que salen sin datos casi siempre son un nombre de pais que V-Dem escribe de otra');
  console.log('forma. Corrige "pais_vdem" en el JSON contra la columna country_name del fichero.\n');
}

if (seco) {
  console.log('Modo seco: no se ha escrito nada.\n');
  process.exit(0);
}

if (!listos.length) {
  console.log('Nada que cargar.\n');
  process.exit(1);
}

const { error: eFuente } = await db().from('fuentes_externas').upsert({
  id: FUENTE,
  nombre: 'V-Dem (Varieties of Democracy)',
  institucion: 'V-Dem Institute, University of Gothenburg',
  tipo: 'encuesta_expertos',
  url: 'https://www.v-dem.net',
  licencia: 'Acceso abierto con cita obligatoria',
  cita: 'Coppedge, M. et al. V-Dem Dataset. V-Dem Institute, University of Gothenburg',
  ola: opcion('ola') || null,
  actualizado_en: new Date().toISOString()
}, { onConflict: 'id' });
if (eFuente) throw eFuente;

const guardadas = await traerTodo<any>((a, b) =>
  db().from('entidades_externas').select('id, clave').range(a, b));
const idPorClave = new Map(guardadas.map((e: any) => [e.clave, e.id]));

const version = `${FUENTE}-${INDICADOR}-${new Date().toISOString().slice(0, 10)}`;
const filas = listos
  .map(r => {
    const entidadId = idPorClave.get(r.regimen.clave);
    if (!entidadId) return null;
    return {
      entidad_id: entidadId,
      fuente_id: FUENTE,
      indicador: 'democracia_liberal',
      anio_desde: r.regimen.desde,
      anio_hasta: r.regimen.hasta,
      valor: r.valores.reduce((a, b) => a + b, 0) / r.valores.length,
      escala_min: 0,
      escala_max: 1,
      n_anios: r.valores.length,
      version_carga: version
    };
  })
  .filter(Boolean) as any[];

const sinEntidad = listos.length - filas.length;
if (sinEntidad > 0) {
  console.log(`${sinEntidad} regimenes no existen todavia como entidad. Ejecuta antes npm run regimenes:codificar.\n`);
}

if (filas.length) {
  const { error } = await db()
    .from('indices_externos')
    .upsert(filas, { onConflict: 'entidad_id,fuente_id,indicador,anio_desde,anio_hasta' });
  if (error) throw error;
}

console.log(`Indices escritos: ${filas.length}`);
console.log(`Version de carga: ${version}\n`);
