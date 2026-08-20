import { db, exigirEnv } from '../src/lib/supabase';
import { normalizarNombre } from '../src/lib/texto';
import { UA } from '../src/lib/descubrir';

exigirEnv('LEGISLATURA_ACTIVA_ID');
const legislaturaId = process.env.LEGISLATURA_ACTIVA_ID!;

const FUENTES = [
  'https://www.lamoncloa.gob.es/gobierno/composiciondelgobierno/paginas/index.aspx',
  'https://www.lamoncloa.gob.es/gobierno/gobiernosporlegislaturas/Paginas/xv_legislatura.aspx'
];

const CARGOS_MESA: [RegExp, string][] = [
  [/presidenta? del congreso/i, 'Presidencia del Congreso'],
  [/vicepresidenta? (primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta) del congreso/i, 'Mesa del Congreso']
];

function limpiar(t: string) {
  return t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/\s+/g, ' ');
}

const PATRON = /((?:vicepresidenta?|ministra?|presidenta?)[^,.;]{0,90}?),\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de|del|la|los|y)\s+)?(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ-]+){1,4})/g;

console.log('\nLeyendo la composicion oficial del Gobierno...\n');

const encontrados = new Map<string, string>();

for (const url of FUENTES) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!r.ok) { console.log(`  ${url} -> HTTP ${r.status}`); continue; }
    const texto = limpiar(await r.text());
    console.log(`  ${url.split('/').pop()} -> ${(texto.length / 1024).toFixed(0)} KB`);

    let m: RegExpExecArray | null;
    PATRON.lastIndex = 0;
    while ((m = PATRON.exec(texto)) !== null) {
      const cargo = m[1].trim().replace(/^(el|la)\s+/i, '');
      const nombre = m[2].trim();
      if (nombre.split(' ').length < 2) continue;
      if (!encontrados.has(nombre)) encontrados.set(nombre, cargo.charAt(0).toUpperCase() + cargo.slice(1));
    }
  } catch (e: any) {
    console.log(`  ${url} -> ${String(e.message).slice(0, 50)}`);
  }
  await new Promise(r => setTimeout(r, 900));
}

console.log(`\n  ${encontrados.size} cargos detectados en la fuente oficial`);

if (encontrados.size === 0) {
  console.log(`
  La pagina de La Moncloa carga por JavaScript o cambio de formato.

  ALTERNATIVA: crea cargos.txt con una linea por persona
    Sánchez Pérez-Castejón | Presidente del Gobierno
  y ejecuta: npm run cargos
`);
  process.exit(0);
}

console.log('\n  DETECTADOS');
encontrados.forEach((cargo, nombre) => console.log(`    ${nombre.padEnd(34)} ${cargo.slice(0, 60)}`));

console.log('\n  Cruzando con los diputados...\n');

let asignados = 0, sinCruce = 0;

for (const [nombre, cargo] of encontrados) {
  const { data: candidatos } = await db().rpc('resolver_nombre', {
    p_nombre: nombre, p_legislatura_id: legislaturaId,
    p_umbral_auto: 0.55, p_umbral_candidato: 0.42
  });

  const mejor = Array.isArray(candidatos) ? candidatos[0] : null;
  if (!mejor || Number(mejor.similitud) < 0.45) {
    sinCruce++;
    console.log(`    no es diputado o no encaja: ${nombre}`);
    continue;
  }

  const { error } = await db().from('cargos_institucionales').upsert(
    { mandato_id: mejor.mandato_id, cargo },
    { onConflict: 'mandato_id' }
  );

  if (error) { console.log(`    ERROR ${nombre}: ${error.message}`); continue; }
  console.log(`    OK  ${String(mejor.nombre_completo).padEnd(36)} ${cargo.slice(0, 52)}  (${Number(mejor.similitud).toFixed(2)})`);
  asignados++;
}

console.log(`\n  asignados: ${asignados}`);
console.log(`  no son diputados o no cruzan: ${sinCruce}`);
console.log('  (muchos ministros no tienen escaño, es normal)');

await db().rpc('refrescar_metricas');
console.log('\n  Revisa el resultado:');
console.log('    select nombre_completo, partido_siglas, cargo, ausencias');
console.log('    from mv_diputados where cargo is not null order by ausencias desc;\n');

export {};
