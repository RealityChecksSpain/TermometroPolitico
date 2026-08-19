import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
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

const yaHechas = await traerTodo<any>((a, b) =>
  db().from('promesa_codigo').select('promesa_id').eq('version_prompt', VERSION).order('promesa_id').range(a, b));
const hechas = new Set(yaHechas.map((r: any) => r.promesa_id));

const todas = await traerTodo<any>((a, b) =>
  db().from('v_promesas').select('id, texto, literal, siglas').order('id').range(a, b));

const pendientes = todas.filter((p: any) => !hechas.has(p.id));

console.log(`\nModelo: ${modeloActivo()}`);
console.log(`Promesas totales: ${todas?.length ?? 0}`);
console.log(`Pendientes: ${pendientes.length}`);
console.log(`Tiempo estimado: ~${Math.round((pendientes.length * 2.3) / 60)} min\n`);

const SOLO_INFORME = process.argv.includes('--informe') || pendientes.length === 0;

const errores = new Map<string, number>();
let todoNeutro = 0;

const progreso = SOLO_INFORME
  ? { procesados: 0, omitidos: 0, fallidos: 0, cuotaAgotada: false }
  : await procesarLote(
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

if (SOLO_INFORME) {
  console.log(pendientes.length === 0
    ? `Todas las ${todas.length} promesas estan codificadas.`
    : 'Modo informe: no se ha codificado nada.');
} else {
  console.log('\nRESULTADO');
  console.log(`  codificadas:   ${progreso.procesados}`);
console.log(`  todo neutro:   ${todoNeutro}`);
console.log(`  fallidas:      ${progreso.fallidos}`);
  console.log(`  omitidas:      ${progreso.omitidos}`);
}

if (!SOLO_INFORME && errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 120)}`));
}

if (!SOLO_INFORME) await db().rpc('refrescar_metricas');

const { data: ejes } = await db().from('mv_eje_programa').select('*').order('eje_economico');
if (ejes?.length) {
  const pintar = (titulo: string, campo: string) => {
    console.log(`\n${titulo}`);
    [...ejes]
      .sort((a: any, b: any) => {
        if (a[campo] === null) return 1;
        if (b[campo] === null) return -1;
        return Number(a[campo]) - Number(b[campo]);
      })
      .forEach((e: any) => {
        if (e[campo] === null || e[campo] === undefined) {
          console.log(`  ${String(e.siglas).padEnd(11)}   sin base suficiente`);
          return;
        }
        const v = Number(e[campo]);
        console.log(`  ${String(e.siglas).padEnd(11)} ${v.toFixed(3).padStart(7)}  ${' '.repeat(Math.round((v + 1) * 20))}#`);
      });
  };

  pintar('EJE ECONOMICO  (-1 izquierda ... +1 derecha)', 'eje_economico');
  pintar('EJE SOCIAL  (-1 progresista ... +1 conservador)', 'eje_social');

  console.log('\nDESGLOSE POR DIMENSION');
  console.log('  ratio: -1 expande ... +1 restringe · (n) = señales que lo sustentan · minimo 10');
  console.log('  PARTIDO           GASTO       IMPUESTOS      REGULACION');
  ejes.forEach((e: any) => {
    const f = (v: any, n: any) => {
      const num = v === null || v === undefined ? '   —' : Number(v).toFixed(2).padStart(5);
      return `${num} (${String(n ?? 0).padStart(3)})`;
    };
    console.log(`  ${String(e.siglas).padEnd(11)} ${f(e.ratio_gasto, e.n_gasto)}  ${f(e.ratio_impuestos, e.n_impuestos)}  ${f(e.ratio_regulacion, e.n_regulacion)}`);
  });
}
console.log('');

export {};