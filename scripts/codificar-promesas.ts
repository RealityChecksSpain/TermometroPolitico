import { db, exigirEnv } from '../src/lib/supabase';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_CODIGO ?? 'codigo-v1-2026-08';

const DIR = { type: 'string', enum: ['aumenta', 'reduce', 'neutro'] };

const ESQUEMA = {
  type: 'object',
  properties: {
    gasto_publico: DIR,
    impuestos: DIR,
    regulacion_mercado: DIR,
    derechos_individuales: DIR,
    apertura_migratoria: DIR,
    descentralizacion: DIR,
    justificacion: { type: 'string' }
  },
  required: ['gasto_publico', 'impuestos', 'regulacion_mercado',
    'derechos_individuales', 'apertura_migratoria', 'descentralizacion', 'justificacion']
};

function prompt(p: any): string {
  return `Codificas compromisos electorales segun SEIS dimensiones objetivas.
No opinas sobre ideologia. Solo describes que hace la medida.

COMPROMISO:
"${p.texto}"
${p.literal ? `\nTEXTO LITERAL DEL PROGRAMA:\n"${p.literal}"` : ''}

Para cada dimension responde "aumenta", "reduce" o "neutro".
"neutro" cuando la medida no toca esa dimension o no se puede saber. Es la respuesta por defecto.

1. gasto_publico
   aumenta: crea prestaciones, servicios, ayudas, plantillas o inversion publica.
   reduce: recorta partidas, suprime organismos o limita gasto.

2. impuestos
   aumenta: crea o sube tributos, cotizaciones o tasas.
   reduce: baja tipos, crea deducciones, exenciones o bonificaciones.

3. regulacion_mercado
   aumenta: impone obligaciones a empresas, topes de precio, controles o requisitos.
   reduce: elimina trabas, liberaliza, privatiza o simplifica requisitos.

4. derechos_individuales
   aumenta: amplia libertades personales, derechos civiles, de minorias o reproductivos.
   reduce: restringe conductas personales, endurece penas por conducta privada o limita derechos.

5. apertura_migratoria
   aumenta: facilita entrada, regularizacion, nacionalidad o acogida.
   reduce: endurece requisitos, expulsiones, control de fronteras o acceso a prestaciones.

6. descentralizacion
   aumenta: transfiere competencias, recursos o capacidad de decision a comunidades autonomas.
   reduce: recentraliza competencias o refuerza el control del Estado sobre ellas.

REGLAS ESTRICTAS:
- Codifica solo lo que la medida hace de forma directa, no sus efectos indirectos.
- Subir el salario minimo NO es gasto publico: es regulacion_mercado aumenta.
- Bajar un impuesto NO es "reduce gasto_publico": es impuestos reduce.
- Ante la duda, "neutro". Preferimos no codificar a codificar mal.
- justificacion: una frase de maximo 15 palabras sobre la dimension principal.
- Espanol de Espana. Sin adjetivos valorativos.`;
}

const { data: yaHechas } = await db()
  .from('promesa_codigo').select('promesa_id').eq('version_prompt', VERSION);
const hechas = new Set((yaHechas ?? []).map((r: any) => r.promesa_id));

const { data: todas, error } = await db()
  .from('v_promesas').select('id, texto, literal, siglas').limit(6000);

if (error) { console.error(error.message); process.exit(1); }
const pendientes = (todas ?? []).filter((p: any) => !hechas.has(p.id));

console.log(`\nModelo: ${modeloActivo()}`);
console.log(`Promesas totales: ${todas?.length ?? 0}`);
console.log(`Pendientes: ${pendientes.length}`);
console.log(`Tiempo estimado: ~${Math.round((pendientes.length * 2.3) / 60)} min\n`);

if (!pendientes.length) {
  console.log('Nada pendiente. Comprueba: select * from mv_eje_programa order by eje_economico;\n');
  process.exit(0);
}

const errores = new Map<string, number>();
let todoNeutro = 0;

const progreso = await procesarLote(
  pendientes,
  async (p: any, cadencia: Cadencia) => {
    const r = await preguntar<any>(prompt(p), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      errores.set(r.error ?? 'sin detalle', (errores.get(r.error ?? 'sin detalle') ?? 0) + 1);
      return null;
    }

    const d = r.datos;
    const campos = ['gasto_publico', 'impuestos', 'regulacion_mercado',
      'derechos_individuales', 'apertura_migratoria', 'descentralizacion'];

    const valido = (v: any) => ['aumenta', 'reduce', 'neutro'].includes(v) ? v : 'neutro';
    const fila: any = { promesa_id: p.id, justificacion: String(d.justificacion ?? '').slice(0, 200),
      modelo: modeloActivo(), version_prompt: VERSION };
    campos.forEach(c => { fila[c] = valido(d[c]); });

    if (campos.every(c => fila[c] === 'neutro')) todoNeutro++;

    const { error: e } = await db().from('promesa_codigo').upsert(fila, { onConflict: 'promesa_id' });
    return e ? null : true;
  },
  {
    alProgreso: (n, total, p: any, ok) => {
      if (n % 25 === 0 || !ok) console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${p.siglas.padEnd(9)} ${String(p.texto).slice(0, 50)}`);
    }
  }
);

console.log('\nRESULTADO');
console.log(`  codificadas:   ${progreso.procesados}`);
console.log(`  todo neutro:   ${todoNeutro}`);
console.log(`  fallidas:      ${progreso.fallidos}`);
console.log(`  omitidas:      ${progreso.omitidos}`);

if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 120)}`));
}

await db().rpc('refrescar_metricas');

const { data: ejes } = await db().from('mv_eje_programa').select('*').order('eje_economico');
if (ejes?.length) {
  console.log('\nEJE ECONOMICO  (-1 izquierda ... +1 derecha)');
  ejes.forEach((e: any) => {
    const v = Number(e.eje_economico ?? 0);
    const pos = Math.round((v + 1) * 20);
    console.log(`  ${String(e.siglas).padEnd(11)} ${String(v.toFixed(3)).padStart(7)}  ${' '.repeat(pos)}#`);
  });

  console.log('\nEJE SOCIAL  (-1 progresista ... +1 conservador)');
  [...ejes].sort((a: any, b: any) => (a.eje_social ?? 0) - (b.eje_social ?? 0)).forEach((e: any) => {
    const v = Number(e.eje_social ?? 0);
    const pos = Math.round((v + 1) * 20);
    console.log(`  ${String(e.siglas).padEnd(11)} ${String(v.toFixed(3)).padStart(7)}  ${' '.repeat(pos)}#`);
  });
}
console.log('');

export {};
