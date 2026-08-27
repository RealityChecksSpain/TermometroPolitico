import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_CODIGO_LEY ?? 'codigo-ley-v3-2026-08';

const DIR = { type: 'string', enum: ['aumenta', 'reduce', 'neutro'] };
const ESQUEMA = {
  type: 'object',
  properties: {
    gasto_publico: DIR, impuestos: DIR, regulacion_mercado: DIR,
    derechos_individuales: DIR, apertura_migratoria: DIR, descentralizacion: DIR,
    moral_tradicional: DIR, religion_estado: DIR, orden_publico: DIR, diversidad_cultural: DIR,
    igualdad_trato: DIR,
    medio_ambiente: DIR,
    integracion_europea: DIR,
    calidad_democratica: DIR,
    justificacion: { type: 'string' }
  },
  required: ['gasto_publico', 'impuestos', 'regulacion_mercado',
    'derechos_individuales', 'apertura_migratoria', 'descentralizacion',
    'moral_tradicional', 'religion_estado', 'orden_publico', 'diversidad_cultural',
    'igualdad_trato', 'medio_ambiente', 'integracion_europea', 'calidad_democratica',
    'justificacion']
};

function prompt(i: any): string {
  const fuente = i.texto_extraido
    ? `TEXTO OFICIAL (extracto):\n---\n${String(i.texto_extraido).slice(0, 18000)}\n---`
    : `RESUMEN: ${i.resumen ?? '(no disponible)'}`;

  return `Codificas una norma del Congreso segun CATORCE dimensiones objetivas.
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
7. moral_tradicional  reduce: refuerza la familia tradicional, restringe aborto, divorcio,
                              eutanasia o identidad de genero, o censura por inmoralidad.
                      aumenta: amplia aborto, divorcio, eutanasia, matrimonio o identidad de genero.
8. religion_estado    reduce: amplia privilegios, financiacion, ensenanza o simbolos de una confesion.
                      aumenta: retira privilegios, financiacion o simbolos confesionales de lo publico.
9. orden_publico      reduce: amplia poderes policiales, penas, vigilancia o limita reunion y protesta.
                      aumenta: limita poderes policiales, rebaja penas o refuerza garantias procesales.
10. diversidad_cultural  reduce: impone asimilacion, restringe lenguas o culturas minoritarias.
                         aumenta: protege lenguas, culturas o minorias, o reconoce pluralidad.
11. igualdad_trato
   aumenta: amplia el acceso a servicios o la proteccion frente a la discriminacion por
            raza, origen, religion, estado civil, orientacion, genero, discapacidad,
            edad o posicion economica.
   reduce: restringe ese acceso o retira protecciones antidiscriminatorias.
   Aqui van accesibilidad, inclusion, no discriminacion y cobertura universal de un
   servicio. NO confundir con derechos_individuales, que es autonomia personal.

12. medio_ambiente
   aumenta: refuerza proteccion ambiental, clima, biodiversidad, agua o transicion energetica.
   reduce: relaja exigencias ambientales o amplia usos extractivos.

13. integracion_europea
   aumenta: cede competencias a la UE, aplica normativa europea o refuerza su papel.
   reduce: recupera soberania, rechaza normativa europea o su jurisdiccion.

14. calidad_democratica
   aumenta: refuerza transparencia, control del poder, independencia judicial,
            lucha contra la corrupcion o participacion directa.
   reduce: debilita controles, opacidad, o somete organos independientes al poder politico.


REGLAS ESTRICTAS:
- Codifica lo que la norma hace de forma directa, no sus efectos indirectos.
- derechos_individuales es SOLO autonomia personal sobre la propia conducta: aborto,
  eutanasia, divorcio, identidad de genero, orientacion sexual, intimidad, libertad de
  expresion, sustancias, libertad reproductiva. Accesibilidad, discapacidad, servicios
  sanitarios, proteccion al consumidor o derechos digitales NO van aqui: van a
  igualdad_trato, gasto_publico o regulacion_mercado segun corresponda.
- La palabra "derecho" en el texto no determina la dimension. Mira que hace la medida.
- Codifica por el efecto sobre quien ejerce la conducta, no sobre quien la presta:
  permitir la objecion de conciencia sanitaria es derechos_individuales reduce.
- Elegir centro o tipo de educacion por motivos religiosos toca religion_estado.
- Subir el salario minimo NO es gasto publico: es regulacion_mercado aumenta.
- Endurecer penas por conducta privada es derechos_individuales reduce; endurecer penas
  por delitos comunes es orden_publico reduce. No marques las dos por el mismo articulo.
- En las dimensiones 7 a 10, "reduce" siempre significa menos autonomia personal o menos
  pluralidad, y "aumenta" siempre lo contrario. Manten ese sentido aunque suene raro.
- Una norma puede responder distinto en cada dimension. No busques coherencia entre ellas.
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

const soloConVotacion = process.env.CODIFICAR_TODAS !== '1';
const pendientes = todas.filter((i: any) =>
  !hechas.has(i.id) && (soloConVotacion ? conVotacion.has(i.id) : true));

console.log(`\nModelo: ${modeloActivo()}`);
console.log(`Iniciativas con votacion asociada: ${conVotacion.size}`);
console.log(`Pendientes de codificar: ${pendientes.length}`);
console.log(`Tiempo estimado: ~${Math.round((pendientes.length * 2.3) / 60)} min\n`);

if (!pendientes.length) {
  console.log('Nada pendiente. Comprueba: select * from v_mapa_partidos;\n');
  process.exit(0);
}

const campos = ['gasto_publico', 'impuestos', 'regulacion_mercado',
  'derechos_individuales', 'apertura_migratoria', 'descentralizacion',
  'moral_tradicional', 'religion_estado', 'orden_publico', 'diversidad_cultural',
  'igualdad_trato', 'medio_ambiente', 'integracion_europea', 'calidad_democratica'];
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