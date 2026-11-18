import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';

const MODELO = process.env.MODELO_COHERENCIA ?? 'gemini-3.1-flash-lite';
process.env.MODELO_IA = MODELO;
const { preguntar, procesarLote, modeloActivo } = await import('../src/lib/gemini');
type Cadencia = InstanceType<typeof import('../src/lib/gemini').Cadencia>;

const VERSION = process.env.VERSION_COHERENCIA ?? 'coherencia-v2-2026-11';
const ELECCION = process.env.ELECCION ?? '2023-07-23';
const INFORME = process.argv.includes('--informe');
const LIMITE = Number(process.argv.find(a => a.startsWith('--limite='))?.split('=')[1] ?? 0);

const ESQUEMA = {
  type: 'object',
  properties: {
    votacion_indice: { type: 'integer' },
    relacion: { type: 'string' },
    justificacion: { type: 'string' }
  },
  required: ['votacion_indice', 'relacion', 'justificacion']
};

function prompt(p: any, candidatas: any[]): string {
  const lista = candidatas
    .map((c, i) => `${i}. [${c.fecha}] ${String(c.titulo).slice(0, 190)}`)
    .join('\n');

  return `Analizas si una votacion del Congreso desarrolla o contradice un compromiso electoral.

COMPROMISO DE ${p.siglas} (programa 2023):
"${p.texto}"

VOTACIONES CANDIDATAS:
${lista}

TAREA: elige la votacion que trata EXACTAMENTE la misma medida que el compromiso.

- votacion_indice: numero de la lista. Si NINGUNA trata la misma medida concreta, devuelve -1.
- relacion: "desarrolla" si aprobar esa votacion cumpliria el compromiso.
            "contradice" si aprobarla iria en contra del compromiso.
            "ninguna" si no hay correspondencia clara.
- justificacion: una frase de maximo 20 palabras explicando la correspondencia.

REGLAS ESTRICTAS:
- Tratar el mismo TEMA no basta. Debe ser la misma MEDIDA.
  "Bajar el IRPF a las rentas bajas" y "Crear un impuesto a la banca" son ambos fiscalidad
  pero NO se corresponden. Devuelve -1.
- Ante la duda, devuelve -1. Es preferible no emparejar que emparejar mal.
- No valores si el compromiso es bueno o malo.
- Espanol de Espana.`;
}

const todas = await traerTodo<any>((a, b) =>
  db().from('v_promesas').select('id, texto, partido, siglas')
    .eq('verificable', true).eq('eleccion', ELECCION).order('id').range(a, b));

const cruces = await traerTodo<any>((a, b) =>
  db().from('promesa_cruce').select('promesa_id, resultado, relacion, coherente').eq('version', VERSION).order('promesa_id').range(a, b));
const hechas = new Set(cruces.map((r: any) => r.promesa_id));

if (INFORME) {
  const actuales = await traerTodo<any>((a, b) =>
    db().from('promesa_votacion').select('promesa_id').order('promesa_id').range(a, b));
  const conVotoAhora = new Set(actuales.map((r: any) => r.promesa_id));
  const porCruce = new Map(cruces.map((r: any) => [r.promesa_id, r]));
  const g = new Map<string, any>();
  for (const p of todas) {
    const x = g.get(p.siglas) ?? { total: 0, cruzadas: 0, nuevas: 0, coherentes: 0, ahora: 0 };
    x.total++;
    const c: any = porCruce.get(p.id);
    if (c) x.cruzadas++;
    if (c?.resultado === 'emparejada') { x.nuevas++; if (c.coherente) x.coherentes++; }
    if (conVotoAhora.has(p.id)) x.ahora++;
    g.set(p.siglas, x);
  }
  console.log(`\nCRUCE ${VERSION} con ${MODELO}, programas de ${ELECCION}\n`);
  console.log('PARTIDO     VERIFICABLES  CRUZADAS  CON VOTACIÓN (NUEVO)  COHERENTES (NUEVO)  CON VOTACIÓN (PUBLICADO)');
  for (const [siglas, x] of [...g.entries()].sort()) {
    console.log(`${String(siglas).padEnd(10)}  ${String(x.total).padStart(12)}  ${String(x.cruzadas).padStart(8)}  ${String(x.nuevas).padStart(20)}  ${String(x.coherentes).padStart(18)}  ${String(x.ahora).padStart(24)}`);
  }
  const faltan = todas.filter((p: any) => !hechas.has(p.id)).length;
  console.log(`\nFaltan por cruzar: ${faltan}${faltan ? ' · vuelve a ejecutar npm run coherencia' : ' · listo para publicar'}\n`);
  process.exit(0);
}

const descartadas = await traerTodo<any>((a, b) =>
  db().from('promesa_votacion_descartada').select('promesa_id, votacion_id').order('promesa_id').range(a, b));
const parDescartado = new Set(descartadas.map((d: any) => `${d.promesa_id}|${d.votacion_id}`));

let pendientes = todas.filter((p: any) => !hechas.has(p.id));
if (LIMITE > 0) pendientes = pendientes.slice(0, LIMITE);

console.log(`\nModelo: ${modeloActivo()} (fijo, no cambia a otro si se acaba la cuota)`);
console.log(`Versión: ${VERSION}`);
console.log(`Promesas verificables de ${ELECCION}: ${todas.length}`);
console.log(`Ya cruzadas en esta versión: ${hechas.size}`);
console.log(`Pendientes: ${pendientes.length}`);
console.log(`Pares descartados que no se vuelven a proponer: ${parDescartado.size}\n`);

if (!pendientes.length) {
  console.log('Nada pendiente. Ejecuta: npm run coherencia -- --informe\n');
  process.exit(0);
}

async function anotar(fila: any) {
  const { error } = await db().from('promesa_cruce').upsert(
    { version: VERSION, modelo: MODELO, votacion_id: null, relacion: null, coherente: null, similitud: null, justificacion: null, ...fila },
    { onConflict: 'promesa_id,version' }
  );
  return !error;
}

let emparejadas = 0, sinCorrespondencia = 0, sinCandidatas = 0, quitadas = 0;
const errores = new Map<string, number>();

const progreso = await procesarLote(
  pendientes,
  async (p: any, cadencia: Cadencia) => {
    const { data: todasCandidatas } = await db().rpc('candidatas_para_promesa', {
      p_promesa_id: p.id, p_limite: 10
    });
    const candidatas = (todasCandidatas ?? []).filter((c: any) => {
      const fuera = parDescartado.has(`${p.id}|${c.votacion_id}`);
      if (fuera) quitadas++;
      return !fuera;
    }).slice(0, 6);

    if (!candidatas?.length) { sinCandidatas++; return (await anotar({ promesa_id: p.id, resultado: 'sin_candidatas' })) || null; }

    const r = await preguntar<any>(prompt(p, candidatas), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      errores.set(r.error ?? 'sin detalle', (errores.get(r.error ?? 'sin detalle') ?? 0) + 1);
      return null;
    }
    if (r.modelo !== MODELO) return null;

    const idx = r.datos.votacion_indice;
    if (typeof idx !== 'number' || idx < 0 || idx >= candidatas.length || !['desarrolla', 'contradice'].includes(r.datos.relacion)) {
      sinCorrespondencia++;
      return (await anotar({ promesa_id: p.id, resultado: 'sin_correspondencia', justificacion: String(r.datos.justificacion ?? '').slice(0, 300) })) || null;
    }

    const c = candidatas[idx];
    const { data: voto } = await db().rpc('voto_del_partido', {
      p_votacion_id: c.votacion_id, p_partido_slug: p.partido
    });

    if (!voto) { sinCorrespondencia++; return (await anotar({ promesa_id: p.id, resultado: 'sin_voto_del_partido', votacion_id: c.votacion_id })) || null; }

    const desarrolla = r.datos.relacion === 'desarrolla';
    const coherente = desarrolla ? voto === 'si' : voto === 'no';

    const ok = await anotar({
      promesa_id: p.id,
      resultado: 'emparejada',
      votacion_id: c.votacion_id,
      coherente,
      relacion: r.datos.relacion,
      similitud: c.similitud,
      justificacion: String(r.datos.justificacion ?? '').slice(0, 300)
    });
    if (!ok) return null;
    emparejadas++;
    return true;
  },
  {
    alProgreso: (n, total, p: any, ok) => {
      if (n % 10 === 0 || !ok) {
        console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${p.siglas.padEnd(9)} ${String(p.texto).slice(0, 52)}  (${emparejadas} emparejadas)`);
      }
    }
  }
);

console.log('\nRESULTADO');
console.log(`  emparejadas con votacion: ${emparejadas}`);
console.log(`  sin correspondencia:      ${sinCorrespondencia}`);
console.log(`  sin candidatas:           ${sinCandidatas}`);
console.log(`  candidatas descartadas:   ${quitadas}`);
console.log(`  fallidas:                 ${progreso.fallidos}`);
console.log(`  omitidas por cuota:       ${progreso.omitidos}`);

if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 120)}`));
}

if (progreso.cuotaAgotada) console.log(`\nCuota diaria de ${MODELO} agotada. Mañana, el mismo comando sigue donde lo dejó.`);
console.log('\nNada de esto cambia la web todavía. Para ver cómo va: npm run coherencia -- --informe\n');

export {};