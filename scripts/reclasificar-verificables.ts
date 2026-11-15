import { db } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { refrescarMetricas } from '../src/lib/metricas';

const MODELO = process.env.MODELO_VERIFICABLE ?? 'gemini-3.1-flash-lite';
const MODELO_CONTROL = process.env.MODELO_CONTROL ?? 'gemini-flash-lite-latest';
const VERSION = 'verificable-v1-2026-11';
const LOTE = Number(process.env.LOTE_VERIFICABLE ?? 30);
const CONTROL = process.argv.includes('--control');
const INFORME = process.argv.includes('--informe');
const APLICAR = process.argv.includes('--aplicar');
const LIMITE = Number(process.argv.find(a => a.startsWith('--limite='))?.split('=')[1] ?? 0);

process.env.MODELO_IA = CONTROL ? MODELO_CONTROL : MODELO;
const version = CONTROL ? `${VERSION}-control` : VERSION;

const { preguntar, procesarLote, modeloActivo } = await import('../src/lib/gemini');

const ESQUEMA = {
  type: 'object',
  properties: {
    resultados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          verificable: { type: 'boolean' },
          motivo: { type: 'string' }
        },
        required: ['n', 'verificable', 'motivo']
      }
    }
  },
  required: ['resultados']
};

function prompt(lote: any[]): string {
  const lista = lote.map((p, i) => `${i}. [${p.siglas}] ${p.texto}`).join('\n');
  return `Clasificas compromisos de programas electorales de las elecciones generales de España.

Para cada compromiso decide si es VERIFICABLE: si se puede contrastar con una votación concreta de las Cortes Generales (Congreso o Senado), es decir, si dice qué medida concreta se tomaría, de forma que al leer el título de una votación se pueda saber si es esa medida o la contraria.

verificable = true cuando el compromiso fija una medida identificable:
- aprobar, derogar o modificar una ley o una norma concreta;
- crear, subir, bajar o suprimir un impuesto, una cuota, una prestación o una partida, aunque no dé la cifra exacta;
- fijar una cifra, un plazo o un porcentaje (por ejemplo, el 7 % del PIB para educación);
- crear o suprimir un organismo, un registro, un derecho o una prohibición concretos;
- una actuación concreta del Gobierno que las Cortes pueden pedir o rechazar en una votación (una auditoría de algo determinado, un plan con nombre y objeto definidos).

verificable = false cuando:
- es una intención o un objetivo sin medida: «impulsar», «fomentar», «apostar por», «promover», «trabajar para», «mejorar», «reforzar», «defender», «avanzar hacia», sin decir cómo;
- es un diagnóstico, una crítica, un principio o un valor;
- lo decide solo un parlamento autonómico, un ayuntamiento o una institución europea, sin intervención de las Cortes.

Reglas:
- Juzga solo el texto, no si la medida es buena, mala, realista o constitucional.
- La misma regla para todos los partidos. Las siglas solo te dicen de quién es.
- Ante la duda entre una medida concreta y una intención, decide por lo que diga el texto: si nombra la medida, true; si solo nombra el objetivo, false.
- motivo: una frase de 15 palabras como máximo que cite la medida concreta o diga por qué no la hay. En español de España.
- Devuelve un resultado por cada número de la lista, con el mismo número n.

COMPROMISOS:
${lista}`;
}

async function leerPromesas() {
  return traerTodo<any>((a, b) =>
    db().from('v_promesas').select('id, texto, siglas, eleccion, verificable').order('id').range(a, b));
}

async function leerDecisiones(v: string) {
  return traerTodo<any>((a, b) =>
    db().from('promesa_verificable').select('promesa_id, verificable, motivo').eq('version', v).order('promesa_id').range(a, b));
}

function enMuestraDeControl(id: string): boolean {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 10 === 0;
}

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)} %` : '—';
}

async function informe() {
  const promesas = await leerPromesas();
  const decisiones = new Map((await leerDecisiones(VERSION)).map((d: any) => [d.promesa_id, d]));
  const grupos = new Map<string, { total: number; antes: number; despues: number; aFalse: number; aTrue: number; sin: number }>();
  for (const p of promesas) {
    const clave = `${p.eleccion}  ${String(p.siglas).padEnd(10)}`;
    const g = grupos.get(clave) ?? { total: 0, antes: 0, despues: 0, aFalse: 0, aTrue: 0, sin: 0 };
    const d: any = decisiones.get(p.id);
    g.total++;
    if (p.verificable) g.antes++;
    if (!d) g.sin++;
    else {
      if (d.verificable) g.despues++;
      if (p.verificable && !d.verificable) g.aFalse++;
      if (!p.verificable && d.verificable) g.aTrue++;
    }
    grupos.set(clave, g);
  }
  console.log('\nELECCION    PARTIDO     PROMESAS  VERIFICABLES AHORA  CON LA REGLA ÚNICA  PASAN A NO  PASAN A SÍ  SIN CLASIFICAR');
  for (const [clave, g] of [...grupos.entries()].sort()) {
    const clasificadas = g.total - g.sin;
    console.log(
      `${clave}  ${String(g.total).padStart(8)}  ${pct(g.antes, g.total).padStart(18)}  ${pct(g.despues, clasificadas).padStart(18)}  ${String(g.aFalse).padStart(10)}  ${String(g.aTrue).padStart(10)}  ${String(g.sin).padStart(14)}`
    );
  }

  const control = await leerDecisiones(`${VERSION}-control`);
  if (control.length) {
    let iguales = 0, comparadas = 0;
    for (const c of control) {
      const d: any = decisiones.get(c.promesa_id);
      if (!d) continue;
      comparadas++;
      if (d.verificable === c.verificable) iguales++;
    }
    console.log(`\nCONTROL con otro modelo (${MODELO_CONTROL}) sobre una muestra fija del 10 %:`);
    console.log(`  coinciden ${iguales} de ${comparadas} (${pct(iguales, comparadas)})`);
  }

  const cambios = promesas.filter((p: any) => decisiones.has(p.id) && (decisiones.get(p.id) as any).verificable !== p.verificable);
  if (cambios.length) {
    console.log('\nEJEMPLOS DE CAMBIOS (al azar):');
    for (const p of [...cambios].sort(() => Math.random() - 0.5).slice(0, 12)) {
      const d: any = decisiones.get(p.id);
      console.log(`  ${d.verificable ? 'pasa a SÍ' : 'pasa a NO'}  [${p.siglas} ${p.eleccion.slice(0, 4)}] ${p.texto}`);
      console.log(`             motivo: ${d.motivo}`);
    }
  }
  console.log('');
}

async function aplicar() {
  const promesas = await leerPromesas();
  const decisiones = new Map((await leerDecisiones(VERSION)).map((d: any) => [d.promesa_id, d.verificable]));
  const sin = promesas.filter((p: any) => !decisiones.has(p.id)).length;
  if (sin > 0) {
    console.log(`\nQuedan ${sin} promesas sin clasificar. Ejecuta antes: npm run verificables\n`);
    process.exit(1);
  }
  const aTrue = promesas.filter((p: any) => decisiones.get(p.id) === true && !p.verificable).map((p: any) => p.id);
  const aFalse = promesas.filter((p: any) => decisiones.get(p.id) === false && p.verificable).map((p: any) => p.id);
  for (const [valor, ids] of [[true, aTrue], [false, aFalse]] as [boolean, string[]][]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await db().from('promesas').update({ verificable: valor }).in('id', ids.slice(i, i + 200));
      if (error) { console.error(`\nERROR al aplicar: ${error.message}\n`); process.exit(1); }
    }
  }
  console.log(`\nAplicado: ${aTrue.length} pasan a verificables y ${aFalse.length} dejan de serlo.`);
  await refrescarMetricas();
  console.log('\nSiguiente: npm run coherencia, para cruzar con votaciones las que pasan a verificables.\n');
}

async function clasificar() {
  const promesas = await leerPromesas();
  const hechas = new Set((await leerDecisiones(version)).map((d: any) => d.promesa_id));
  let pendientes = promesas.filter((p: any) => !hechas.has(p.id) && (!CONTROL || enMuestraDeControl(p.id)));
  if (LIMITE > 0) pendientes = pendientes.slice(0, LIMITE);

  const lotes: any[][] = [];
  for (let i = 0; i < pendientes.length; i += LOTE) lotes.push(pendientes.slice(i, i + LOTE));

  console.log(`\nModelo: ${modeloActivo()}${CONTROL ? ' (control)' : ''}`);
  console.log(`Promesas: ${promesas.length} · ya clasificadas: ${hechas.size} · pendientes: ${pendientes.length}`);
  console.log(`Llamadas a la IA: ${lotes.length}\n`);
  if (!lotes.length) {
    console.log(CONTROL ? 'Control terminado. Ejecuta: npm run verificables -- --informe\n' : 'Todo clasificado. Ejecuta: npm run verificables -- --informe\n');
    return;
  }

  let guardadas = 0;
  const progreso = await procesarLote(lotes, async (lote, cadencia) => {
    const r = await preguntar<any>(prompt(lote), cadencia, { esquema: ESQUEMA, temperatura: 0 });
    if (!r.ok || !r.datos) return null;
    if (r.modelo !== modeloActivo()) return null;
    const vistos = new Set<number>();
    const filas = (r.datos.resultados ?? [])
      .filter((x: any) => Number.isInteger(x.n) && x.n >= 0 && x.n < lote.length && typeof x.verificable === 'boolean' && !vistos.has(x.n) && vistos.add(x.n))
      .map((x: any) => ({
        promesa_id: lote[x.n].id,
        version,
        modelo: r.modelo,
        verificable: x.verificable,
        motivo: String(x.motivo ?? '').slice(0, 300)
      }));
    if (!filas.length) return null;
    const { error } = await db().from('promesa_verificable').upsert(filas, { onConflict: 'promesa_id,version' });
    if (error) { console.error(`  error al guardar: ${error.message}`); return null; }
    guardadas += filas.length;
    return true;
  }, {
    alProgreso: (n, total, _l, ok) => {
      if (n % 10 === 0 || !ok || n === total) console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} (${guardadas} guardadas)`);
    }
  });

  console.log('\nRESULTADO');
  console.log(`  promesas clasificadas: ${guardadas}`);
  console.log(`  sin respuesta (se repiten al volver a ejecutar): ${pendientes.length - guardadas}`);
  if (progreso.cuotaAgotada) console.log('  cuota diaria agotada: vuelve a ejecutarlo mañana, sigue donde lo dejó');
  console.log(`\nSiguiente: ${pendientes.length - guardadas > 0 ? 'vuelve a ejecutar el mismo comando para las que faltan' : 'npm run verificables -- --informe'}\n`);
}

if (INFORME) await informe();
else if (APLICAR) await aplicar();
else await clasificar();

export {};
