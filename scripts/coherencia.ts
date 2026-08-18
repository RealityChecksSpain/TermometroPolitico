import { db, exigirEnv } from '../src/lib/supabase';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_COHERENCIA ?? 'coherencia-v1-2026-08';

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

const { data: yaHechas } = await db()
  .from('promesa_votacion').select('promesa_id').eq('version_prompt', VERSION);
const hechas = new Set((yaHechas ?? []).map((r: any) => r.promesa_id));

const { data: todas, error } = await db()
  .from('v_promesas')
  .select('id, texto, partido, siglas')
  .eq('verificable', true)
  .limit(5000);

if (error) { console.error(error.message); process.exit(1); }

const pendientes = (todas ?? []).filter((p: any) => !hechas.has(p.id));

console.log(`\nModelo: ${modeloActivo()}`);
console.log(`Promesas verificables: ${todas?.length ?? 0}`);
console.log(`Pendientes: ${pendientes.length}`);
console.log(`Tiempo estimado: ~${Math.round((pendientes.length * 2.3) / 60)} min\n`);

if (!pendientes.length) {
  console.log('Nada pendiente. Comprueba: select * from mv_coherencia;\n');
  process.exit(0);
}

let emparejadas = 0, sinCorrespondencia = 0, sinCandidatas = 0;
const errores = new Map<string, number>();

const progreso = await procesarLote(
  pendientes,
  async (p: any, cadencia: Cadencia) => {
    const { data: candidatas } = await db().rpc('candidatas_para_promesa', {
      p_promesa_id: p.id, p_limite: 6
    });

    if (!candidatas?.length) { sinCandidatas++; return true; }

    const r = await preguntar<any>(prompt(p, candidatas), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      errores.set(r.error ?? 'sin detalle', (errores.get(r.error ?? 'sin detalle') ?? 0) + 1);
      return null;
    }

    const idx = r.datos.votacion_indice;
    if (typeof idx !== 'number' || idx < 0 || idx >= candidatas.length || r.datos.relacion === 'ninguna') {
      sinCorrespondencia++;
      return true;
    }

    const c = candidatas[idx];
    const { data: voto } = await db().rpc('voto_del_partido', {
      p_votacion_id: c.votacion_id, p_partido_slug: p.partido
    });

    if (!voto) { sinCorrespondencia++; return true; }

    const desarrolla = r.datos.relacion === 'desarrolla';
    const coherente = desarrolla ? voto === 'si' : voto === 'no';

    const { error: e } = await db().from('promesa_votacion').upsert({
      promesa_id: p.id,
      votacion_id: c.votacion_id,
      coherente,
      similitud: c.similitud,
      justificacion: String(r.datos.justificacion ?? '').slice(0, 300),
      modelo: modeloActivo(),
      version_prompt: VERSION
    }, { onConflict: 'promesa_id,votacion_id' });

    if (e) return null;
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
console.log(`  fallidas:                 ${progreso.fallidos}`);
console.log(`  omitidas por cuota:       ${progreso.omitidos}`);

if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 120)}`));
}

await db().rpc('refrescar_metricas');
console.log('\nComprueba: select * from mv_coherencia order by pct_coherencia desc;\n');

export {};
