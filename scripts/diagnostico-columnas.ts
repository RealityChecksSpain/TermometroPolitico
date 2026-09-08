import { readFileSync, existsSync } from 'node:fs';
import { ESQUEMAS, POLOS, EJES } from '../src/lib/escalas';
import type { EjeId } from '../src/lib/escalas';

const args = process.argv.slice(2);
const opcion = (n: string) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
};

const FUENTE = opcion('fuente') || 'vparty';
const EJE = (opcion('eje') || 'con_pro') as EjeId;
const CUANTOS = Number(opcion('cuantos') ?? '') || 8;
const RUTA = opcion('fichero') || `datos/externas/${FUENTE}.csv`;

const esquema = ESQUEMAS[FUENTE];
if (!esquema) {
  console.error(`\nFuente desconocida: ${FUENTE}`);
  console.error(`Declaradas: ${Object.keys(ESQUEMAS).join(', ')}\n`);
  process.exit(1);
}

if (!EJES.includes(EJE)) {
  console.error(`\nEje desconocido: ${EJE}`);
  console.error(`Declarados: ${EJES.join(', ')}\n`);
  process.exit(1);
}

const medida = esquema.medidas[EJE];
if (!medida) {
  console.error(`\nLa fuente ${FUENTE} no declara el eje ${EJE}.`);
  console.error(`Declara: ${Object.keys(esquema.medidas).join(', ')}\n`);
  process.exit(1);
}

if (!existsSync(RUTA)) {
  console.error(`\nNo existe ${RUTA}. Pasa otra ruta con --fichero.\n`);
  process.exit(1);
}

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

const texto = readFileSync(RUTA, 'utf8');
const delim = detectarDelimitador(texto.split('\n', 1)[0] ?? '');
const crudo = partirCSV(texto, delim);
const cabeceras = crudo[0].map(c => c.trim());

const idx = (candidatos: string[]) => {
  for (const n of candidatos) {
    const i = cabeceras.findIndex(c => c.toLowerCase() === n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
};

const iPais = idx(esquema.pais);
const iNombre = idx(esquema.nombreCorto ?? esquema.nombre);
const iAnio = idx(esquema.anio);

const [poloBajo, poloAlto] = POLOS[EJE];

console.log(`\n=== Polos por columna cruda ===`);
console.log(`Fuente ${FUENTE} · eje ${EJE} · ${RUTA}`);
console.log(`\nEsto ignora la orientacion declarada en escalas.ts y ensena el dato tal cual`);
console.log(`viene del fichero. Para cada columna, mira que partidos ocupan cada extremo y`);
console.log(`deduce el sentido real. Si el valor ALTO lo ocupan partidos de "${poloAlto}",`);
console.log(`esa columna va con orientacion 1. Si lo ocupan de "${poloBajo}", va con -1.\n`);

for (const col of medida.columnas) {
  const i = idx([col.nombre]);
  if (i < 0) {
    console.log(`--- ${col.nombre}: NO ESTA EN EL FICHERO\n`);
    continue;
  }

  const filas: { v: number; etiqueta: string }[] = [];
  for (let f = 1; f < crudo.length; f++) {
    const v = Number((crudo[f][i] ?? '').trim());
    if (!Number.isFinite(v)) continue;
    const nombre = (crudo[f][iNombre] ?? '?').trim();
    const pais = (crudo[f][iPais] ?? '?').trim();
    const anio = (crudo[f][iAnio] ?? '?').trim().slice(0, 4);
    filas.push({ v, etiqueta: `${nombre}  (${pais} ${anio})` });
  }

  if (!filas.length) {
    console.log(`--- ${col.nombre}: sin valores numericos\n`);
    continue;
  }

  filas.sort((a, b) => a.v - b.v);
  const min = filas[0].v;
  const max = filas[filas.length - 1].v;

  console.log(`--- ${col.nombre}   (${filas.length} valores, de ${min.toFixed(2)} a ${max.toFixed(2)})`);
  console.log(`    declarada hoy con orientacion ${col.orientacion}`);
  console.log('  VALOR MAS BAJO:');
  filas.slice(0, CUANTOS).forEach(f =>
    console.log(`    ${f.v.toFixed(2).padStart(6)}  ${f.etiqueta}`));
  console.log('  VALOR MAS ALTO:');
  filas.slice(-CUANTOS).reverse().forEach(f =>
    console.log(`    ${f.v.toFixed(2).padStart(6)}  ${f.etiqueta}`));
  console.log('');
}

console.log('Cuando sepas el sentido de cada columna, se corrigen los signos en');
console.log('src/lib/escalas.ts y se recarga la fuente.\n');