import { readdirSync, statSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import ts from 'typescript';

const RAIZ = resolve(process.cwd());
const SALIDA = join(RAIZ, '.comprobacion-api');
const ENTRADAS = 'api';
const IMPORTA = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;

function ficherosTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(n => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return ficherosTs(ruta);
    return /\.ts$/.test(n) && !/\.d\.ts$/.test(n) ? [ruta] : [];
  });
}

function resolverRelativo(desde: string, especificador: string): string | null {
  const base = resolve(dirname(desde), especificador);
  const candidatos = base.endsWith('.js')
    ? [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'), base]
    : [`${base}.ts`, `${base}.tsx`, base, join(base, 'index.ts')];
  return candidatos.find(c => existsSync(c) && statSync(c).isFile()) ?? null;
}

const entradas = ficherosTs(join(RAIZ, ENTRADAS));
if (entradas.length === 0) {
  console.log('\nNo hay funciones en api/. Nada que comprobar.\n');
  process.exit(0);
}

const alcanzables = new Set<string>();
const problemas: string[] = [];
const cola = [...entradas];

while (cola.length) {
  const fichero = cola.pop()!;
  if (alcanzables.has(fichero)) continue;
  alcanzables.add(fichero);

  const codigo = readFileSync(fichero, 'utf8');
  let m: RegExpExecArray | null;
  IMPORTA.lastIndex = 0;
  while ((m = IMPORTA.exec(codigo)) !== null) {
    const especificador = m[1];
    if (!especificador.startsWith('.')) continue;
    const corto = relative(RAIZ, fichero);
    if (!/\.(js|mjs|cjs|json)$/.test(especificador)) {
      problemas.push(`${corto}: "${especificador}" sin extensión .js. En Vercel esto es ERR_MODULE_NOT_FOUND.`);
      continue;
    }
    const destino = resolverRelativo(fichero, especificador);
    if (!destino) {
      problemas.push(`${corto}: "${especificador}" no apunta a ningún fichero del repositorio.`);
      continue;
    }
    cola.push(destino);
  }
}

if (problemas.length) {
  console.log('\nIMPORTACIONES QUE NO SOBREVIVEN AL DESPLIEGUE\n');
  problemas.forEach(p => console.log(`  ${p}`));
  console.log('');
  process.exit(1);
}

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');

for (const fichero of alcanzables) {
  const destino = join(SALIDA, relative(RAIZ, fichero).replace(/\.tsx?$/, '.js'));
  mkdirSync(dirname(destino), { recursive: true });
  const { outputText } = ts.transpileModule(readFileSync(fichero, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  });
  writeFileSync(destino, outputText, 'utf8');
}

let fallos = 0;
for (const entrada of entradas) {
  const corto = relative(RAIZ, entrada);
  const destino = join(SALIDA, relative(RAIZ, entrada).replace(/\.tsx?$/, '.js'));
  try {
    await import(pathToFileURL(destino).href);
    console.log(`  ok   ${corto}`);
  } catch (e: any) {
    fallos++;
    console.log(`  FALLA ${corto}`);
    console.log(`        ${String(e?.message ?? e).split('\n')[0]}`);
  }
}

rmSync(SALIDA, { recursive: true, force: true });

if (fallos > 0) {
  console.log(`\n${fallos} de ${entradas.length} funciones de api/ no arrancan como lo harían en Vercel.\n`);
  process.exit(1);
}

console.log(`\nLas ${entradas.length} funciones de api/ cargan con las mismas reglas que Vercel.\n`);
