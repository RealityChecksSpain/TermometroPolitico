import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_CODIGO_LEY ?? 'codigo-ley-v1-2026-08';

const DIR = { type: 'string', enum: ['aumenta', 'reduce', 'neutro'] };
const ESQUEMA = {
  type: 'object',
  properties: {
    gasto_publico: DIR, impuestos: DIR, regulacion_mercado: DIR,
    derechos_individuales: DIR, apertura_migratoria: DIR, descentralizacion: DIR,
    justificacion: { type: 'string' }
  },
  required: ['gasto_publico', 'impuestos', 'regulacion_mercado',
    'derechos_individuales', 'apertura_migratoria', 'descentralizacion', 'justificacion']
};

function prompt(i: any): string {
  const fuente = i.texto_extraido
    ? `TEXTO OFICIAL (extracto):\n---\n${String(i.texto_extraido).slice(0, 18000)}\n---`
    : `RESUMEN: ${i.resumen ?? '(no disponible)'}`;

  return `Codificas una norma del Congreso segun SEIS dimensiones objetivas.
No opinas sobre ideologia. Solo describes que hace la norma SI SE APRUEBA.

TITULO: ${i.titulo}
${fuente}

Para cada dimension responde "aumenta", "reduce" o "neutro".
"neutro" cuando la norma no toca esa dimension. Es la respuesta por defecto.

1. gasto_publico   aumenta: crea prestaciones, servicios, ayudas o inversion publica.
                   reduce: recorta partidas, suprime organismos o limita gasto.
2. impuestos       aumenta: crea o sube tributos, cotizaciones o tasas.
                   reduce: baja tipos, crea deducciones o exenciones.
3. regulacion_mercado  aumenta: impone obligaciones a empresas, topes o requisitos.
                       reduce: liberaliza, privatiza o simplifica requisitos.
4. derechos_individuales  aumenta: amplia libertades personales o derechos civiles.
                          reduce: restringe conductas personales o endurece penas por conducta privada.
5. apertura_migratoria  aumenta: facilita entrada, regularizacion o acogida.
                        reduce: endurece requisitos, expulsiones o control de fronteras.
6. descentralizacion  aumenta: transfiere competencias o recursos a comunidades autonomas.
                      reduce: recentraliza competencias.

REGLAS ESTRICTAS:
- Codifica lo que la norma hace de forma directa, no sus efectos indirectos.
- Subir el salario minimo NO es gasto publico: es regulacion_mercado aumenta.
- Ante la duda, "neutro". Preferimos no codificar a codificar mal.
- justificacion: una frase de maximo 15 palabras.
- Espanol de Espana. Sin adjetivos valorativos.`;
}

const yaHechas = await traerTodo<any>((a, b) =>
  db().from('iniciativa_codigo').select('iniciativa_id').eq('version_prompt', VERSION).order('iniciativa_id').range(a, b));
const hechas = new Set(yaHechas.map((r: any) => r.iniciativa_id));

const enlazadas = await traerTodo<any>((a, b) =>
  db().from('votacion_iniciativa').select('iniciativa_id').order('iniciativa_id').range(a, b));
const conVotacion = new Set(enlazadas.map((r: any) => r.iniciativa_id));

const todas = await traerTodo<any>((a, b) =>
  db().from('iniciativas').select('id, titulo, texto_extraido, texto_chars')
    .order('id').range(a, b));

const pendientes = todas.filter((i: any) => !hechas.has(i.id) && conVotacion.has(i.id));

console.log(`\nModelo: ${modeloActivo()}`);
console.log(`Iniciativas con votacion asociada: ${conVotacion.size}`);
console.log(`Pendientes de codificar: ${pendientes.length}`);
console.log(`Tiempo estimado: ~${Math.round((pendientes.length * 2.3) / 60)} min\n`);

if (!pendientes.length) {
  console.log('Nada pendiente. Comprueba: select * from v_mapa_partidos;\n');
  process.exit(0);
}

const campos = ['gasto_publico', 'impuestos', 'regulacion_mercado',
  'derechos_individuales', 'apertura_migratoria', 'descentralizacion'];
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