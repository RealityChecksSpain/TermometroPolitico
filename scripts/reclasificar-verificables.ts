import { db } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { refrescarMetricas } from '../src/lib/metricas';

const MODELO = process.env.MODELO_VERIFICABLE ?? 'gemini-3.1-flash-lite';
const MODELO_CONTROL = process.env.MODELO_CONTROL ?? 'gemini-flash-lite-latest';
const MODELO_DESEMPATE = process.env.MODELO_DESEMPATE ?? 'gemini-flash-latest';
const VERSION = 'verificable-v2-2026-11';
const V_CONTROL = `${VERSION}-control`;
const V_DESEMPATE = `${VERSION}-desempate`;
const LOTE = Number(process.env.LOTE_VERIFICABLE ?? 30);
const CONTROL = process.argv.includes('--control');
const TODO = process.argv.includes('--todo');
const DESEMPATE = process.argv.includes('--desempate');
const INFORME = process.argv.includes('--informe');
const APLICAR = process.argv.includes('--aplicar');
const POR_DESEMPATE = process.env.DESACUERDO === 'desempate';
const DUDA_ES_SI = process.env.DESACUERDO === 'si';
const LIMITE = Number(process.argv.find(a => a.startsWith('--limite='))?.split('=')[1] ?? 0);

process.env.MODELO_IA = DESEMPATE ? MODELO_DESEMPATE : CONTROL ? MODELO_CONTROL : MODELO;
const version = DESEMPATE ? V_DESEMPATE : CONTROL ? V_CONTROL : VERSION;
process.env.MAX_TOKENS_IA ??= '16384';

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
- fijar una cifra, un plazo o un porcentaje de la propia medida: un presupuesto, un impuesto, un salario, una plantilla, una prestación (por ejemplo, el 7 % del PIB para educación);
- crear o suprimir un organismo, un registro, un derecho o una prohibición concretos;
- una actuación concreta del Gobierno que las Cortes pueden pedir o rechazar en una votación (una auditoría de algo determinado, un plan con nombre y objeto definidos).

verificable = false cuando:
- es una intención o un objetivo sin medida: «impulsar», «fomentar», «apostar por», «promover», «trabajar para», «mejorar», «reforzar», «defender», «avanzar hacia», sin decir cómo;
- es un diagnóstico, una crítica, un principio o un valor;
- es un resultado que se quiere conseguir y no la medida para conseguirlo, aunque lleve cifra: «reducir un 50 % los accidentes mortales», «que el 10 % de la electricidad sea de autoconsumo en 2030», «bajar el paro al 8 %»;
- solo dice que se estudiará, evaluará, revisará o analizará algo, sin decir qué cambiará;
- lo decide solo un parlamento autonómico, un ayuntamiento o una institución europea, sin intervención de las Cortes: aprobar una directiva o reformar los tratados de la Unión es decisión europea; trasponer una directiva con una ley española sí es de las Cortes.

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

async function decisiones() {
  const [principal, control, desempate] = await Promise.all([leerDecisiones(VERSION), leerDecisiones(V_CONTROL), leerDecisiones(V_DESEMPATE)]);
  const m = new Map(principal.map((d: any) => [d.promesa_id, d]));
  const c = new Map(control.map((d: any) => [d.promesa_id, d]));
  const d = new Map(desempate.map((x: any) => [x.promesa_id, x]));
  return { m, c, d };
}

function final(id: string, dec: any): { valor: boolean; motivo: string; via: string } | null {
  const m = dec.m.get(id);
  const c = dec.c.get(id);
  if (!m) return null;
  if (!c) return { valor: m.verificable, motivo: m.motivo, via: 'solo' };
  if (m.verificable === c.verificable) return { valor: m.verificable, motivo: m.motivo, via: 'acuerdo' };
  if (POR_DESEMPATE) {
    const d = dec.d.get(id);
    if (!d) return null;
    return { valor: d.verificable, motivo: d.motivo, via: 'desempate' };
  }
  return { valor: DUDA_ES_SI, motivo: `Los dos modelos no coinciden. Uno: ${m.verificable ? m.motivo : c.motivo}`, via: 'duda' };
}

async function informe() {
  const promesas = await leerPromesas();
  const dec = await decisiones();
  const grupos = new Map<string, any>();
  let conControl = 0, iguales = 0, sinControl = 0, sinDesempate = 0;
  for (const p of promesas) {
    const clave = `${p.eleccion}  ${String(p.siglas).padEnd(10)}`;
    const g = grupos.get(clave) ?? { total: 0, antes: 0, despues: 0, decididas: 0, aFalse: 0, aTrue: 0, comparadas: 0, iguales: 0, pendientes: 0, dudas: 0 };
    g.total++;
    if (p.verificable) g.antes++;
    const m: any = dec.m.get(p.id);
    const c: any = dec.c.get(p.id);
    if (m && c) {
      g.comparadas++; conControl++;
      if (m.verificable === c.verificable) { g.iguales++; iguales++; }
      else if (POR_DESEMPATE && !dec.d.has(p.id)) sinDesempate++;
    } else if (m) sinControl++;
    const f = final(p.id, dec);
    if (!f || f.via === 'solo') g.pendientes++;
    if (f?.via === 'duda') g.dudas++;
    if (f) {
      g.decididas++;
      if (f.valor) g.despues++;
      if (p.verificable && !f.valor) g.aFalse++;
      if (!p.verificable && f.valor) g.aTrue++;
    }
    grupos.set(clave, g);
  }
  console.log('\nELECCION    PARTIDO     PROMESAS  VERIFICABLES AHORA  CON LA REGLA ÚNICA  PASAN A NO  PASAN A SÍ  ACUERDO ENTRE MODELOS  EN DUDA  PENDIENTES');
  for (const [clave, g] of [...grupos.entries()].sort()) {
    console.log(
      `${clave}  ${String(g.total).padStart(8)}  ${pct(g.antes, g.total).padStart(18)}  ${pct(g.despues, g.decididas).padStart(18)}  ${String(g.aFalse).padStart(10)}  ${String(g.aTrue).padStart(10)}  ${pct(g.iguales, g.comparadas).padStart(21)}  ${String(g.dudas).padStart(7)}  ${String(g.pendientes).padStart(10)}`
    );
  }
  console.log(`\nModelos: principal ${MODELO} · control ${MODELO_CONTROL} · desempate ${MODELO_DESEMPATE}`);
  console.log(`Coinciden principal y control en ${iguales} de ${conControl} (${pct(iguales, conControl)})`);
  console.log(POR_DESEMPATE
    ? `Desempates resueltos: ${dec.d.size} · sin control todavía: ${sinControl} · desacuerdos sin desempate: ${sinDesempate}`
    : `Si los dos modelos no coinciden, la promesa cuenta como ${DUDA_ES_SI ? 'SÍ' : 'NO'} verificable (columna EN DUDA). Sin los dos modelos todavía: ${sinControl}`);

  const cambios = promesas.filter((p: any) => { const f = final(p.id, dec); return f && f.via !== 'solo' && f.valor !== p.verificable; });
  if (cambios.length) {
    console.log('\nEJEMPLOS DE CAMBIOS (al azar):');
    for (const p of [...cambios].sort(() => Math.random() - 0.5).slice(0, 12)) {
      const f: any = final(p.id, dec);
      console.log(`  ${f.valor ? 'pasa a SÍ' : 'pasa a NO'}  [${p.siglas} ${p.eleccion.slice(0, 4)}] ${p.texto}`);
      console.log(`             ${f.via}: ${f.motivo}`);
    }
  }
  console.log('');
}

async function aplicar() {
  const promesas = await leerPromesas();
  const dec = await decisiones();
  const falta = promesas.filter((p: any) => { const f = final(p.id, dec); return !f || f.via === 'solo'; }).length;
  if (falta > 0) {
    console.log(`\nQuedan ${falta} promesas sin la decisión de los dos modelos. Vuelve a ejecutar npm run verificables y npm run verificables -- --control --todo\n`);
    process.exit(1);
  }
  const aTrue = promesas.filter((p: any) => final(p.id, dec)!.valor && !p.verificable).map((p: any) => p.id);
  const aFalse = promesas.filter((p: any) => !final(p.id, dec)!.valor && p.verificable).map((p: any) => p.id);
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
  let enDisputa: Set<string> | null = null;
  if (DESEMPATE) {
    const dec = await decisiones();
    enDisputa = new Set(promesas.filter((p: any) => dec.m.has(p.id) && dec.c.has(p.id) && dec.m.get(p.id).verificable !== dec.c.get(p.id).verificable).map((p: any) => p.id));
  }
  let pendientes = promesas.filter((p: any) => !hechas.has(p.id)
    && (!CONTROL || TODO || enMuestraDeControl(p.id))
    && (!enDisputa || enDisputa.has(p.id)));
  if (LIMITE > 0) pendientes = pendientes.slice(0, LIMITE);

  const lotes: any[][] = [];
  for (let i = 0; i < pendientes.length; i += LOTE) lotes.push(pendientes.slice(i, i + LOTE));

  console.log(`\nModelo: ${modeloActivo()}${DESEMPATE ? ' (desempate)' : CONTROL ? ' (control)' : ''}`);
  console.log(`Promesas: ${promesas.length} · ya clasificadas: ${hechas.size} · pendientes: ${pendientes.length}`);
  console.log(`Llamadas a la IA: ${lotes.length}\n`);
  if (!lotes.length) {
    console.log('Nada pendiente. Ejecuta: npm run verificables -- --informe\n');
    return;
  }

  let guardadas = 0;
  let errores = 0;
  const progreso = await procesarLote(lotes, async (lote, cadencia) => {
    const r = await preguntar<any>(prompt(lote), cadencia, { esquema: ESQUEMA, temperatura: 0 });
    if (!r.ok || !r.datos) {
      if (++errores <= 3) console.log(`  sin respuesta: ${r.error ?? 'formato no válido'}`);
      return null;
    }
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
