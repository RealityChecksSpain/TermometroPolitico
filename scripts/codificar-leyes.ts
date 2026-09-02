import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

import { ESQUEMA, prompt } from '../src/lib/prompt-leyes';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_CODIGO_LEY ?? 'codigo-ley-v5-2026-08';

const campos = ['gasto_publico', 'impuestos', 'regulacion_mercado',
  'derechos_individuales', 'apertura_migratoria', 'descentralizacion',
  'moral_tradicional', 'religion_estado', 'orden_publico', 'diversidad_cultural',
  'igualdad_trato', 'medio_ambiente', 'integracion_europea', 'calidad_democratica',
  'propiedad_publica', 'proteccion_laboral', 'ortodoxia_fiscal',
  'proteccionismo', 'nacionalismo', 'autoridad_estatal'];
const errores = new Map<string, number>();
let todoNeutro = 0;

const progreso = await procesarLote(
  pendientes,
  async (i: any, cadencia: Cadencia) => {
    const r = await preguntar<any>(prompt(i), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      errores.set(r.error ?? 'sin detalle', (errores.get(r.error ?? 'sin detalle') ?? 0) + 1);
      return null;
    }
    const valido = (v: any) => ['aumenta', 'reduce', 'neutro'].includes(v) ? v : 'neutro';
    const fila: any = {
      iniciativa_id: i.id,
      justificacion: String(r.datos.justificacion ?? '').slice(0, 200),
      modelo: modeloActivo(), version_prompt: VERSION
    };
    campos.forEach(c => { fila[c] = valido(r.datos[c]); });
    if (campos.every(c => fila[c] === 'neutro')) todoNeutro++;

    const { error: e } = await db().from('iniciativa_codigo').upsert(fila, { onConflict: 'iniciativa_id' });
    return e ? null : true;
  },
  {
    alProgreso: (n, total, i: any, ok) => {
      if (n % 25 === 0 || !ok) console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${String(i.titulo).slice(0, 56)}`);
    }
  }
);

console.log('\nRESULTADO');
console.log(`  codificadas: ${progreso.procesados}`);
console.log(`  todo neutro: ${todoNeutro}`);
console.log(`  fallidas:    ${progreso.fallidos}`);
console.log(`  omitidas:    ${progreso.omitidos}`);

if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 120)}`));
}

await db().rpc('refrescar_metricas');

const { data: mapa } = await db().from('v_mapa_partidos').select('*');
if (mapa?.length) {
  console.log('\nEJE ECONOMICO   programa | votos   (-1 izquierda ... +1 derecha)');
  mapa.sort((a: any, b: any) => (a.prog_economico ?? 0) - (b.prog_economico ?? 0))
    .forEach((m: any) => console.log(
      `  ${String(m.siglas).padEnd(11)} ${String(m.prog_economico ?? '—').padStart(7)} | ${String(m.voto_economico ?? '—').padStart(7)}   (${m.promesas_codificadas ?? 0} promesas, ${m.leyes_valoradas ?? 0} leyes)`
    ));
}
console.log('');

export {};