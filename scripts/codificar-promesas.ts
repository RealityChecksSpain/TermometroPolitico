import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_CODIGO ?? 'codigo-v5-2026-08';

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
    moral_tradicional: DIR,
    religion_estado: DIR,
    orden_publico: DIR,
    diversidad_cultural: DIR,
    igualdad_trato: DIR,
    medio_ambiente: DIR,
    integracion_europea: DIR,
    calidad_democratica: DIR,
    propiedad_publica: DIR,
    proteccion_laboral: DIR,
    ortodoxia_fiscal: DIR,
    proteccionismo: DIR,
    nacionalismo: DIR,
    autoridad_estatal: DIR,
    justificacion: { type: 'string' }
  },
  required: ['gasto_publico', 'impuestos', 'regulacion_mercado',
    'derechos_individuales', 'apertura_migratoria', 'descentralizacion',
    'moral_tradicional', 'religion_estado', 'orden_publico', 'diversidad_cultural',
    'igualdad_trato', 'medio_ambiente', 'integracion_europea', 'calidad_democratica',
    'propiedad_publica', 'proteccion_laboral', 'ortodoxia_fiscal',
    'proteccionismo', 'nacionalismo', 'autoridad_estatal',
    'justificacion']
};

function prompt(p: any): string {
  return `Codificas compromisos electorales segun VEINTE dimensiones objetivas.
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

7. moral_tradicional
   reduce: refuerza la familia tradicional, restringe aborto, divorcio, eutanasia o identidad
           de genero, o censura contenidos por inmoralidad.
   aumenta: amplia aborto, divorcio, eutanasia, matrimonio o identidad de genero.

8. religion_estado
   reduce: amplia privilegios, financiacion, ensenanza o simbolos de una confesion.
   aumenta: retira privilegios, financiacion o simbolos confesionales del ambito publico.

9. orden_publico
   reduce: amplia poderes policiales, penas, vigilancia o limita reunion y protesta.
   aumenta: limita poderes policiales, rebaja penas o refuerza garantias procesales.

10. diversidad_cultural
   reduce: impone asimilacion, restringe lenguas o culturas minoritarias.
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


15. propiedad_publica
   reduce: privatiza, externaliza o vende empresa o servicio publico.
   aumenta: nacionaliza, remunicipaliza o crea empresa publica.

16. proteccion_laboral
   reduce: facilita el despido, abarata la contratacion, debilita la negociacion colectiva.
   aumenta: refuerza derechos laborales, negociacion colectiva, estabilidad o salario minimo.

17. ortodoxia_fiscal
   reduce: relaja reglas de gasto, deficit o deuda.
   aumenta: refuerza estabilidad presupuestaria, techo de gasto o reduccion de deuda.
   Ojo al sentido: aqui "aumenta" es mas disciplina fiscal, que es posicion de derecha
   economica. Es la unica dimension economica con este sentido invertido.

18. proteccionismo
   reduce: abre mercados, elimina aranceles o barreras comerciales.
   aumenta: impone aranceles, cuotas o barreras a la competencia exterior.

19. nacionalismo
   reduce: relativiza simbolos, lengua comun o identidad nacional espanola.
   aumenta: refuerza simbolos, lengua comun, patriotismo o identidad nacional espanola.

20. autoridad_estatal
   reduce: refuerza organismos independientes, contrapesos o autonomia de agencias.
   aumenta: concentra poder en el Ejecutivo o somete organos independientes al Gobierno.

REGLAS ESTRICTAS:
- derechos_individuales es SOLO autonomia personal sobre la propia conducta: aborto,
  eutanasia, divorcio, identidad de genero, orientacion sexual, intimidad, libertad de
  expresion, sustancias, libertad reproductiva. Accesibilidad, discapacidad, servicios
  sanitarios, proteccion al consumidor o derechos digitales NO van aqui: van a
  igualdad_trato, gasto_publico o regulacion_mercado segun corresponda.
- La palabra "derecho" en el texto no determina la dimension. Mira que hace la medida.
- Codifica por el efecto sobre quien ejerce la conducta, no sobre quien la presta:
  permitir la objecion de conciencia sanitaria es derechos_individuales reduce.
- Elegir centro o tipo de educacion por motivos religiosos toca religion_estado.
- ortodoxia_fiscal SOLO se activa si la norma habla de reglas fiscales: deficit, techo
  de gasto, deuda publica, estabilidad presupuestaria, senda de consolidacion o regla
  de gasto. Que una medida cueste dinero NO es ortodoxia_fiscal: eso es gasto_publico.
  Que una medida baje la recaudacion NO es ortodoxia_fiscal: eso es impuestos reduce.
  Una bonificacion, una deduccion o un tipo reducido son impuestos, nunca ortodoxia_fiscal.
- Despido, convenios, temporalidad y salario minimo van a proteccion_laboral, no a
  regulacion_mercado. regulacion_mercado es normativa sobre la actividad de las empresas.
- Deficit, deuda y reglas de gasto van a ortodoxia_fiscal, no a gasto_publico.
- Lengua y simbolos del Estado van a nacionalismo; lenguas minoritarias a diversidad_cultural.
- autoridad_estatal es poder politico del Ejecutivo; orden_publico es policia, penas y protesta.
- Codifica solo lo que la medida hace de forma directa, no sus efectos indirectos.
- gasto_publico solo si el Estado desembolsa dinero de forma directa e identificable:
  una partida, una subvencion, una prestacion, una plantilla o una inversion.
  El coste indirecto de aplicar una ley NO es gasto_publico.
- Los verbos de intencion sin instrumento concreto van a neutro en todas las dimensiones:
  impulsar, promover, fomentar, avanzar en, trabajar por, salvo que la promesa diga
  con que dinero o con que norma se hace.
- Una medida penal o de seguridad es orden_publico, nunca gasto_publico.
  Endurecer penas por conducta privada es derechos_individuales reduce; por delitos
  comunes es orden_publico reduce. No marques las dos por lo mismo.
- En las dimensiones 7 a 10, reduce significa siempre menos autonomia personal o menos
  pluralidad, y aumenta siempre lo contrario. Manten ese sentido aunque suene raro.
- Una promesa puede responder distinto en cada dimension. No busques coherencia entre ellas.
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
      'derechos_individuales', 'apertura_migratoria', 'descentralizacion',
      'moral_tradicional', 'religion_estado', 'orden_publico', 'diversidad_cultural',
      'igualdad_trato', 'medio_ambiente', 'integracion_europea', 'calidad_democratica',
      'propiedad_publica', 'proteccion_laboral', 'ortodoxia_fiscal',
      'proteccionismo', 'nacionalismo', 'autoridad_estatal'];

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