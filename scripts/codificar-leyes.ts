import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';
import { ESQUEMA, prompt } from '../src/lib/prompt-leyes';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_CODIGO_LEY ?? 'codigo-ley-v6-2026-09';

const campos = ['gasto_publico', 'impuestos', 'regulacion_mercado',
  'derechos_individuales', 'apertura_migratoria', 'descentralizacion',
  'moral_tradicional', 'religion_estado', 'orden_publico', 'diversidad_cultural',
  'igualdad_trato', 'medio_ambiente', 'integracion_europea', 'calidad_democratica',
  'propiedad_publica', 'proteccion_laboral', 'ortodoxia_fiscal',
  'proteccionismo', 'nacionalismo', 'autoridad_estatal'];

const yaHechas = await traerTodo<any>((a, b) =>
  db().from('iniciativa_codigo').select('iniciativa_id')
    .eq('version_prompt', VERSION).order('iniciativa_id').range(a, b));
const hechas = new Set(yaHechas.map((r: any) => r.iniciativa_id));

const todas = await traerTodo<any>((a, b) =>
  db().from('iniciativas').select('id, titulo, texto_extraido').order('id').range(a, b));

const pendientes = todas.filter((i: any) => !hechas.has(i.id));

console.log(`\nModelo:      ${modeloActivo()}`);
console.log(`Version:     ${VERSION}`);
console.log(`Iniciativas: ${todas.length}`);
console.log(`Pendientes:  ${pendientes.length}`);
console.log(`Estimado:    ~${Math.round((pendientes.length * 2.3) / 60)} min\n`);

if (!pendientes.length) {
  console.log(todas.length === 0
    ? 'No hay iniciativas cargadas. Ejecuta antes: npm run iniciativas\n'
    : `Nada pendiente: las ${hechas.size} iniciativas ya estan codificadas con ${VERSION}.\n`);
  process.exit(0);
}

const errores = new Map<string, number>();
const porModelo = new Map<string, number>();
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
    const usado = r.modelo ?? modeloActivo();
    porModelo.set(usado, (porModelo.get(usado) ?? 0) + 1);
    const fila: any = {
      iniciativa_id: i.id,
      justificacion: String(r.datos.justificacion ?? '').slice(0, 200),
      modelo: r.modelo ?? modeloActivo(), version_prompt: VERSION
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

if (porModelo.size > 0) {
  console.log('\nQUIEN HA CODIFICADO');
  Array.from(porModelo.entries()).sort((a, b) => b[1] - a[1])
    .forEach(([m, n]) => console.log(`  ${String(n).padStart(4)}  ${m}`));
}

if (porModelo.size > 1) {
  console.log('\nAVISO: esta version la han codificado varios modelos.');
  console.log('Cual codifica cual cambia en cada tanda segun quien tenga cuota, y eso mueve');
  console.log('los ejes entre ejecuciones identicas. Para una version publicable, fija el');
  console.log('modelo y reanuda al dia siguiente:');
  console.log(`  MODELO_IA=${Array.from(porModelo.keys())[0]} VERSION_CODIGO_LEY=${VERSION} npm run codificar:leyes`);
}

if (progreso.cuotaAgotada) {
  console.log(`\nCuota agotada. Quedan ${progreso.omitidos} sin codificar.`);
  console.log('Relanza manana con la misma VERSION_CODIGO_LEY y seguira donde lo dejo.');
}

if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 120)}`));
}

if (progreso.fallidos > 0 || progreso.omitidos > 0) {
  const sinCodificar = progreso.fallidos + progreso.omitidos;
  console.log(`\nCORPUS INCOMPLETO: ${sinCodificar} de ${todas.length} normas sin codificar con ${VERSION}.`);
  console.log('Esas normas conservan el codigo de la version anterior, asi que la base es ahora');
  console.log('una mezcla de dos versiones y los ejes no son atribuibles a ninguna.');
  console.log('Relanza la misma linea hasta que salgan 0 fallidas antes de correr ejes o placebo:');
  console.log(`  MODELO_IA=${modeloActivo()} VERSION_CODIGO_LEY=${VERSION} npm run codificar:leyes`);
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