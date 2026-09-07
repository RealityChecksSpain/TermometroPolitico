import { readFileSync, existsSync } from 'node:fs';
import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import {
  DIMENSIONES, ESQUEMA_VALORES, EJES_REGIMEN, Regimen,
  normalizarRespuesta, posicionDesdeVotos, prompt
} from '../src/lib/prompt-regimenes';
import { Cadencia } from '../src/lib/gemini';
import { leerConsejo, familias, comprobarCredenciales, preguntarMiembro, media, desviacion } from '../src/lib/consejo';

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

const RUTA = opcion('fichero') || 'datos/regimenes/regimenes.json';
const VERSION = process.env.VERSION_REGIMEN ?? 'regimen-v1';
const FUENTE = 'escano_documental';
const seco = bandera('seco');
const rehacer = bandera('rehacer');
const MIN_DIMENSIONES = Number(opcion('minimo-dimensiones') || process.env.MIN_DIMENSIONES || 12);
const MIN_CODIFICADORES = Number(opcion('minimo') || process.env.MIN_CODIFICADORES || 3);

if (!existsSync(RUTA)) {
  console.error(`\nNo existe ${RUTA}.\n`);
  process.exit(1);
}

const regimenes: Regimen[] = JSON.parse(readFileSync(RUTA, 'utf8'));
const consejo = leerConsejo();

console.log(`\nRegimenes: ${regimenes.length}`);
console.log(`Consejo:   ${consejo.map(m => m.id).join(', ')}`);
console.log(`Familias:  ${familias(consejo)}`);
console.log(`Version:   ${VERSION}`);
console.log(`Minimos:   ${MIN_CODIFICADORES} codificadores por regimen, ${MIN_DIMENSIONES} dimensiones validas por respuesta\n`);

const sinClave = comprobarCredenciales(consejo);
if (sinClave.length) {
  console.error('Faltan claves para estos miembros del consejo:');
  sinClave.forEach(f => console.error(`  ${f}`));
  console.error('\nAnadelas al .env de la raiz o quita esos miembros de CONSEJO.\n');
  process.exit(1);
}

if (consejo.length < 3) {
  console.log('AVISO: con menos de tres miembros no hay mayoria posible en los empates.\n');
}
if (familias(consejo) < 2) {
  console.log('AVISO: todos los miembros son del mismo proveedor. El acuerdo entre ellos mide');
  console.log('       estabilidad del prompt, no fiabilidad entre codificadores independientes.\n');
}

const cadencias = new Map<string, Cadencia>();

const yaVotado = await traerTodo<any>((a, b) =>
  db().from('regimen_codigo_voto')
    .select('entidad_clave, modelo')
    .eq('version_prompt', VERSION)
    .order('entidad_clave')
    .range(a, b));
const hechos = new Set(yaVotado.map((v: any) => `${v.entidad_clave}|${v.modelo}`));

let preguntas = 0;
let fallos = 0;
const pendientes: { regimen: Regimen; miembro: typeof consejo[number] }[] = [];

async function codificar(r: Regimen, miembro: typeof consejo[number], reintento: boolean): Promise<boolean> {
  const res = await preguntarMiembro(miembro, prompt(r), ESQUEMA_VALORES, cadencias);
  preguntas++;

  if (!res.ok || !res.datos) {
    console.log(`    ${miembro.id.padEnd(46)} FALLO: ${String(res.error ?? '').slice(0, 60)}`);
    if (!reintento) pendientes.push({ regimen: r, miembro });
    else fallos++;
    return false;
  }

  const { valores, citas } = normalizarRespuesta(res.datos);
  const validas = DIMENSIONES.filter(d => valores[d]);

  if (validas.length < MIN_DIMENSIONES) {
    console.log(`    ${miembro.id.padEnd(46)} DESCARTADO: solo ${validas.length}/${DIMENSIONES.length} dimensiones validas`);
    if (!reintento) pendientes.push({ regimen: r, miembro });
    else fallos++;
    return false;
  }

  const filas = validas.map(d => ({
    entidad_clave: r.clave,
    modelo: miembro.id,
    version_prompt: VERSION,
    dimension: d,
    valor: valores[d],
    cita: String(citas[d] ?? '').slice(0, 300) || null
  }));

  const noNeutro = filas.filter(f => f.valor !== 'neutro').length;

  if (noNeutro === 0) {
    console.log(`    ${miembro.id.padEnd(46)} DESCARTADO: las ${validas.length} dimensiones en neutro`);
    console.log(`      Un regimen entero en neutro no aporta informacion y suele ser un rechazo del modelo.`);
    if (!reintento) pendientes.push({ regimen: r, miembro });
    else fallos++;
    return false;
  }

  console.log(`    ${miembro.id.padEnd(46)} ${noNeutro}/${validas.length} dimensiones con signo`);

  if (seco) return true;

  const { error } = await db()
    .from('regimen_codigo_voto')
    .upsert(filas, { onConflict: 'entidad_clave,modelo,version_prompt,dimension' });
  if (error) {
    fallos++;
    console.log(`    ERROR al guardar: ${error.message}`);
    return false;
  }
  return true;
}

for (const r of regimenes) {
  console.log(`--- ${r.nombre} (${r.desde}-${r.hasta})`);

  for (const miembro of consejo) {
    if (!rehacer && hechos.has(`${r.clave}|${miembro.id}`)) {
      console.log(`    ${miembro.id.padEnd(46)} ya codificado`);
      continue;
    }

    await codificar(r, miembro, false);
  }
  console.log('');
}

if (pendientes.length) {
  console.log(`Reintentando ${pendientes.length} codificaciones que fallaron...\n`);
  for (const { regimen, miembro } of pendientes) {
    console.log(`--- ${regimen.nombre_corto}`);
    await new Promise(r => setTimeout(r, 8000));
    await codificar(regimen, miembro, true);
  }
  console.log('');
}

console.log(`Preguntas lanzadas: ${preguntas}`);
console.log(`Fallos: ${fallos}\n`);

if (seco) {
  console.log('Modo seco: no se ha escrito nada.\n');
  process.exit(0);
}

const votos = await traerTodo<any>((a, b) =>
  db().from('regimen_codigo_voto')
    .select('entidad_clave, modelo, dimension, valor')
    .eq('version_prompt', VERSION)
    .order('entidad_clave')
    .range(a, b));

const porRegimen = new Map<string, Map<string, Record<string, string>>>();
for (const v of votos) {
  if (!porRegimen.has(v.entidad_clave)) porRegimen.set(v.entidad_clave, new Map());
  const m = porRegimen.get(v.entidad_clave)!;
  if (!m.has(v.modelo)) m.set(v.modelo, {});
  m.get(v.modelo)![v.dimension] = v.valor;
}

const { error: eFuente } = await db().from('fuentes_externas').upsert({
  id: FUENTE,
  nombre: 'Codificacion documental por consejo de modelos',
  institucion: 'Escano',
  tipo: 'codificacion_documental',
  url: 'https://github.com/MarcosJVPR/TermometroPolitico',
  licencia: 'Produccion propia',
  cita: 'Codificacion de politica documentada por consejo de modelos de lenguaje, con cita por dimension',
  ola: VERSION,
  actualizado_en: new Date().toISOString()
}, { onConflict: 'id' });
if (eFuente) throw eFuente;

const entidades = regimenes.map(r => ({
  clave: r.clave,
  tipo: 'regimen',
  nombre: r.nombre,
  nombre_corto: r.nombre_corto,
  pais_nombre: r.pais_nombre,
  desde: r.desde,
  hasta: r.hasta,
  actualizado_en: new Date().toISOString()
}));

const { error: eEnt } = await db().from('entidades_externas').upsert(entidades, { onConflict: 'clave' });
if (eEnt) throw eEnt;

const guardadas = await traerTodo<any>((a, b) =>
  db().from('entidades_externas').select('id, clave').range(a, b));
const idPorClave = new Map(guardadas.map((e: any) => [e.clave, e.id]));

const posiciones: any[] = [];

console.log('POSICION POR CONSEJO\n');

for (const r of regimenes) {
  const porModelo = porRegimen.get(r.clave);
  if (!porModelo || porModelo.size === 0) {
    console.log(`  ${r.nombre_corto.padEnd(20)} sin votos`);
    continue;
  }
  const entidadId = idPorClave.get(r.clave);
  if (!entidadId) continue;

  for (const eje of ['izq_der', 'con_pro'] as const) {
    const valores: number[] = [];
    const usadas = new Set<string>();
    for (const votosModelo of porModelo.values()) {
      const p = posicionDesdeVotos(votosModelo, eje);
      if (!p) continue;
      valores.push(p.valor);
      p.usadas.forEach(u => usadas.add(u));
    }
    if (!valores.length) continue;

    if (valores.length < MIN_CODIFICADORES) {
      console.log(
        `  ${r.nombre_corto.padEnd(20)} ${eje.padEnd(9)} DESCARTADO: solo ${valores.length} de ${MIN_CODIFICADORES} codificadores`
      );
      continue;
    }

    const valor = media(valores);
    const sd = desviacion(valores);

    console.log(
      `  ${r.nombre_corto.padEnd(20)} ${eje.padEnd(9)} ${valor.toFixed(2)} ` +
      `± ${sd.toFixed(2)}  (${valores.length} codificadores, ${usadas.size} de ${EJES_REGIMEN[eje].length} dimensiones)`
    );

    posiciones.push({
      fuente_id: FUENTE,
      entidad_id: entidadId,
      eje,
      anio: r.hasta,
      valor_bruto: valor,
      escala_min: 0,
      escala_max: 10,
      orientacion: 1,
      columnas: Array.from(usadas),
      incertidumbre: sd,
      publicado: false,
      version_carga: `${FUENTE}-${VERSION}-${new Date().toISOString().slice(0, 10)}`
    });
  }
}

if (posiciones.length) {
  const { error } = await db()
    .from('posiciones_externas')
    .upsert(posiciones, { onConflict: 'fuente_id,entidad_id,eje,anio' });
  if (error) throw error;
}

if (!posiciones.length) {
  console.log('\nNingun regimen alcanza el minimo de codificadores. No se escribe ninguna posicion.');
  console.log(`Baja el minimo con --minimo 2 solo si asumes que con dos codificadores no hay mayoria posible.`);
}

console.log(`\nPosiciones escritas: ${posiciones.length}`);
console.log('\nQuedan SIN PUBLICAR. Revisa el desacuerdo entre codificadores y las citas antes de publicar:');
console.log(`  npm run regimenes:acuerdo`);
console.log(`  npm run posiciones:publicar -- --fuente ${FUENTE} --eje izq_der\n`);