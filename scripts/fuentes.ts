import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { motivoUrlInvalida } from '../src/lib/fuenteUrl';

const CARPETA = 'datos/cuentas';

const PLACEHOLDERS: Record<string, { marca: string; ficheros: string[]; que: string }> = {
  erc2024: {
    marca: 'FUENTE_ERC_2024',
    ficheros: ['2024.csv'],
    que: "ERC 2024: Balanc de Situacio i Compte d'Explotacio"
  },
  erc2025: {
    marca: 'FUENTE_ERC_2025',
    ficheros: ['2025.csv'],
    que: "ERC 2025: Balanc de Situacio i Compte d'Explotacio"
  },
  junts2024: {
    marca: 'FUENTE_JUNTS_2024',
    ficheros: ['2024.csv'],
    que: 'Junts 2024: EEFF i Memoria 2024'
  },
  cc2025: {
    marca: 'FUENTE_CC_2025',
    ficheros: ['2025.csv'],
    que: 'Coalicion Canaria 2025: informe financiero consolidado'
  },
  tribunal2020: {
    marca: 'FUENTE_TRIBUNAL_2020',
    ficheros: ['2020.csv'],
    que: 'Tribunal de Cuentas: informe n.o 1.573, cuentas anuales de los partidos politicos, ejercicio 2020'
  }
};

function ayuda(): never {
  console.log('\nRellena las fuentes que faltan en datos/cuentas/*.csv\n');
  console.log('  node --import tsx scripts/fuentes.ts clave=URL [clave=URL ...]\n');
  console.log('Claves disponibles:');
  for (const [clave, p] of Object.entries(PLACEHOLDERS)) {
    console.log(`  ${clave.padEnd(14)} ${p.que}`);
  }
  console.log('\nPuedes pasar las que tengas; las demas se quedan como estan.');
  console.log('Sin argumentos, muestra cuantas filas siguen pendientes en cada fichero.\n');
  process.exit(1);
}

function pendientes(): void {
  console.log('');
  let total = 0;
  for (const [clave, p] of Object.entries(PLACEHOLDERS)) {
    for (const f of p.ficheros) {
      const ruta = join(CARPETA, f);
      if (!existsSync(ruta)) continue;
      const n = readFileSync(ruta, 'utf8').split('\n').filter(l => l.includes(p.marca)).length;
      if (n) {
        console.log(`  ${f}  ${String(n).padStart(3)} filas  ${clave}`);
        total += n;
      }
    }
  }
  if (!total) console.log('  No queda ninguna fuente sin rellenar.');
  console.log('');
}

const args = process.argv.slice(2);

if (!args.length) {
  pendientes();
  process.exit(0);
}

if (args.includes('--ayuda') || args.includes('-h')) ayuda();

const nuevas = new Map<string, string>();
const problemas: string[] = [];

for (const a of args) {
  const i = a.indexOf('=');
  if (i === -1) { problemas.push(`"${a}" no tiene la forma clave=URL`); continue; }
  const clave = a.slice(0, i).trim();
  const url = a.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  if (!PLACEHOLDERS[clave]) { problemas.push(`"${clave}" no es una clave valida`); continue; }
  const mal = motivoUrlInvalida(url);
  if (mal) { problemas.push(`${clave}: la URL ${mal}`); continue; }
  if (nuevas.has(clave)) { problemas.push(`${clave}: repetida`); continue; }
  nuevas.set(clave, url);
}

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s). No se ha tocado nada:\n`);
  for (const p of problemas) console.log(`  ${p}`);
  console.log('');
  ayuda();
}

const cambios: string[] = [];
const porFichero = new Map<string, string>();

for (const [clave, url] of nuevas) {
  const p = PLACEHOLDERS[clave];
  for (const f of p.ficheros) {
    const ruta = join(CARPETA, f);
    if (!existsSync(ruta)) { console.log(`  aviso: no existe ${ruta}, salto ${clave}`); continue; }
    const antes = porFichero.get(f) ?? readFileSync(ruta, 'utf8');
    const n = antes.split(p.marca).length - 1;
    if (!n) { cambios.push(`${f}: ${clave} ya estaba rellenada`); continue; }
    porFichero.set(f, antes.split(p.marca).join(url));
    cambios.push(`${f}: ${String(n).padStart(3)} filas <- ${clave}`);
  }
}

for (const [f, texto] of porFichero) {
  writeFileSync(join(CARPETA, f), texto, 'utf8');
}

console.log('');
for (const c of cambios) console.log(`  ${c}`);
console.log(`\n${porFichero.size} fichero(s) reescrito(s).`);
pendientes();
