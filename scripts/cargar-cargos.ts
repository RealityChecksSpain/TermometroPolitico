import { db, exigirEnv } from '../src/lib/supabase';
import { UA } from '../src/lib/descubrir';
import { refrescarMetricas } from '../src/lib/metricas';

exigirEnv('LEGISLATURA_ACTIVA_ID');
const legislaturaId = process.env.LEGISLATURA_ACTIVA_ID!;

const APLICAR = process.argv.includes('--aplicar');
const CON_HISTORICO = process.argv.includes('--historico');

const UMBRAL_AUTO = 0.7;
const UMBRAL_REVISAR = 0.45;

const FUENTE_ACTUAL = 'https://www.lamoncloa.gob.es/gobierno/composiciondelgobierno/paginas/index.aspx';
const FUENTE_HISTORICA = 'https://www.lamoncloa.gob.es/gobierno/gobiernosporlegislaturas/Paginas/xv_legislatura.aspx';

const PALABRAS_CARTERA = new Set([
  'formacion', 'profesional', 'deportes', 'funcion', 'publica', 'transicion', 'ecologica',
  'reto', 'demografico', 'economia', 'comercio', 'empresa', 'hacienda', 'trabajo', 'social',
  'seguridad', 'digital', 'justicia', 'interior', 'defensa', 'sanidad', 'consumo', 'cultura',
  'ciencia', 'innovacion', 'universidades', 'agricultura', 'pesca', 'alimentacion', 'industria',
  'turismo', 'transportes', 'movilidad', 'vivienda', 'agenda', 'urbana', 'inclusion',
  'migraciones', 'igualdad', 'juventud', 'infancia', 'exteriores', 'union', 'europea',
  'cooperacion', 'politica', 'territorial', 'memoria', 'democratica', 'presidencia',
  'relaciones', 'cortes', 'educacion', 'gobierno', 'estado', 'ministerio', 'secretaria',
  'portavoz', 'consejo', 'ministros', 'espana', 'nacional', 'derechos', 'sociales',
  'ecologico', 'gestion', 'financiera'
]);

const PATRON = /\b((?:vicepresident[ae]|ministr[ao]|president[ae])[^;.]{0,90}?),\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ-]+){1,4})/gi;

function limpiar(t: string) {
  return t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/\s+/g, ' ');
}

function sinTildes(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function pareceNombre(bruto: string): boolean {
  const piezas = bruto.trim().split(/\s+/);
  if (piezas.length < 2 || piezas.length > 5) return false;
  const significativas = piezas.filter(p => !/^(de|del|la|las|los|y)$/i.test(p));
  if (significativas.length < 2) return false;
  if (!significativas.every(p => /^[A-ZÁÉÍÓÚÑ]/.test(p))) return false;
  if (significativas.some(p => PALABRAS_CARTERA.has(sinTildes(p)))) return false;
  return true;
}

function normalizarCargo(cargo: string): string {
  const t = cargo.trim().replace(/^(el|la)\s+/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Hallado = { nombre: string; cargo: string; fuente: string };

const hallados: Hallado[] = [];
const fuentes = CON_HISTORICO ? [FUENTE_ACTUAL, FUENTE_HISTORICA] : [FUENTE_ACTUAL];

console.log('\nLeyendo la composicion oficial del Gobierno...\n');
if (!CON_HISTORICO) {
  console.log('  Solo la pagina de composicion actual.');
  console.log('  La pagina de la legislatura lista tambien a ex ministros: anadela con --historico\n');
}

for (const url of fuentes) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!r.ok) { console.log(`  ${url} -> HTTP ${r.status}`); continue; }
    const texto = limpiar(await r.text());
    console.log(`  ${url.split('/').pop()} -> ${(texto.length / 1024).toFixed(0)} KB`);

    let m: RegExpExecArray | null;
    PATRON.lastIndex = 0;
    let descartados = 0;
    while ((m = PATRON.exec(texto)) !== null) {
      const cargo = normalizarCargo(m[1]);
      const nombre = m[2].trim();
      if (!pareceNombre(nombre)) { descartados++; continue; }
      hallados.push({ nombre, cargo, fuente: url === FUENTE_ACTUAL ? 'actual' : 'historica' });
    }
    if (descartados > 0) console.log(`     ${descartados} capturas descartadas por no parecer un nombre de persona`);
  } catch (e: any) {
    console.log(`  ${url} -> ${String(e.message).slice(0, 60)}`);
  }
  await new Promise(r => setTimeout(r, 900));
}

console.log(`\n  ${hallados.length} pares cargo-persona detectados`);

if (hallados.length === 0) {
  console.log(`
  La pagina de La Moncloa carga por JavaScript o cambio de formato.

  ALTERNATIVA: copia cargos.ejemplo.txt a cargos.txt, escribe una linea por
  persona tras verificarla en la fuente oficial, y ejecuta: npm run cargos
`);
  process.exit(0);
}

type Resuelto = {
  mandatoId: string;
  nombreOficial: string;
  similitud: number;
  cargos: Set<string>;
  fuentes: Set<string>;
  nombresCrudos: Set<string>;
};

const porMandato = new Map<string, Resuelto>();
const sinCruce: Hallado[] = [];
const dudosos: { h: Hallado; nombreOficial: string; similitud: number }[] = [];

console.log('\n  Cruzando con los diputados...\n');

for (const h of hallados) {
  const { data: candidatos } = await db().rpc('resolver_nombre', {
    p_nombre: h.nombre, p_legislatura_id: legislaturaId,
    p_umbral_auto: UMBRAL_AUTO, p_umbral_candidato: UMBRAL_REVISAR
  });

  const mejor = Array.isArray(candidatos) ? candidatos[0] : null;
  const similitud = mejor ? Number(mejor.similitud) : 0;

  if (!mejor || similitud < UMBRAL_REVISAR) { sinCruce.push(h); continue; }
  if (similitud < UMBRAL_AUTO) {
    dudosos.push({ h, nombreOficial: String(mejor.nombre_completo), similitud });
    continue;
  }

  const previo = porMandato.get(mejor.mandato_id);
  if (previo) {
    previo.cargos.add(h.cargo);
    previo.fuentes.add(h.fuente);
    previo.nombresCrudos.add(h.nombre);
    previo.similitud = Math.max(previo.similitud, similitud);
  } else {
    porMandato.set(mejor.mandato_id, {
      mandatoId: mejor.mandato_id,
      nombreOficial: String(mejor.nombre_completo),
      similitud,
      cargos: new Set([h.cargo]),
      fuentes: new Set([h.fuente]),
      nombresCrudos: new Set([h.nombre])
    });
  }
}

const limpios: Resuelto[] = [];
const contradictorios: Resuelto[] = [];
for (const r of porMandato.values()) {
  if (r.cargos.size > 1) contradictorios.push(r); else limpios.push(r);
}

console.log('  FIABLES');
if (limpios.length === 0) console.log('    ninguno');
limpios.forEach(r => console.log(
  `    ${r.nombreOficial.padEnd(36)} ${Array.from(r.cargos)[0].slice(0, 58)}  (${r.similitud.toFixed(2)})`
));

if (contradictorios.length > 0) {
  console.log('\n  CONTRADICTORIOS, no se aplican');
  contradictorios.forEach(r => {
    console.log(`    ${r.nombreOficial}`);
    Array.from(r.cargos).forEach(c => console.log(`        ${c.slice(0, 74)}`));
  });
}

if (dudosos.length > 0) {
  console.log(`\n  PARECIDO INSUFICIENTE (entre ${UMBRAL_REVISAR} y ${UMBRAL_AUTO}), no se aplican`);
  dudosos.forEach(d => console.log(
    `    ${d.h.nombre.padEnd(30)} -> ${d.nombreOficial.padEnd(34)} (${d.similitud.toFixed(2)})  ${d.h.cargo.slice(0, 40)}`
  ));
}

if (sinCruce.length > 0) {
  console.log('\n  NO SON DIPUTADOS O NO CRUZAN');
  sinCruce.forEach(h => console.log(`    ${h.nombre.padEnd(30)} ${h.cargo.slice(0, 50)}`));
}

console.log(`\n  fiables: ${limpios.length}   contradictorios: ${contradictorios.length}   dudosos: ${dudosos.length}   sin cruce: ${sinCruce.length}`);

if (!APLICAR) {
  console.log(`
  NO SE HA ESCRITO NADA EN LA BASE.

  Un cargo equivocado colgado de un diputado real cambia lo que publica la web:
  el hallazgo de ausencias excluye a quien tenga cargo. Por eso esto solo propone.

  Pega en cargos.txt las lineas que hayas verificado en lamoncloa.gob.es
  y ejecuta despues: npm run cargos
`);
  if (limpios.length > 0) {
    console.log('  PROPUESTA PARA cargos.txt\n');
    limpios.forEach(r => console.log(`${r.nombreOficial} | ${Array.from(r.cargos)[0]}`));
    console.log('');
  }
  console.log('  Si ya lo has comprobado y quieres escribirlo tal cual: npm run cargos:auto -- --aplicar\n');
  process.exit(0);
}

let escritos = 0;
for (const r of limpios) {
  const { error } = await db().from('cargos_institucionales').upsert(
    { mandato_id: r.mandatoId, cargo: Array.from(r.cargos)[0] },
    { onConflict: 'mandato_id' }
  );
  if (error) { console.log(`    ERROR ${r.nombreOficial}: ${error.message}`); continue; }
  escritos++;
}

console.log(`\n  escritos: ${escritos}`);
await refrescarMetricas();

console.log('\n  Comprueba uno a uno antes de dar por bueno el resultado:');
console.log('    select nombre_completo, partido_siglas, cargo, ausencias');
console.log('    from mv_diputados where cargo is not null order by ausencias desc;\n');

export {};