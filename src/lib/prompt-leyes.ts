export const DIR = { type: 'string', enum: ['aumenta', 'reduce', 'neutro'] };
export const ESQUEMA = {
  type: 'object',
  properties: {
    gasto_publico: DIR, impuestos: DIR, regulacion_mercado: DIR,
    derechos_individuales: DIR, apertura_migratoria: DIR, descentralizacion: DIR,
    moral_tradicional: DIR, religion_estado: DIR, orden_publico: DIR, diversidad_cultural: DIR,
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

export function prompt(i: any): string {
  const fuente = i.texto_extraido
    ? `TEXTO OFICIAL (extracto):\n---\n${String(i.texto_extraido).slice(0, 18000)}\n---`
    : `RESUMEN: ${i.resumen ?? '(no disponible)'}`;

  return `Codificas una norma del Congreso segun VEINTE dimensiones objetivas.
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


15. propiedad_publica     reduce: privatiza, externaliza o vende empresa o servicio publico.
                         aumenta: nacionaliza, remunicipaliza o crea empresa publica.
16. proteccion_laboral   reduce: facilita el despido o debilita la negociacion colectiva.
                         aumenta: refuerza derechos laborales, estabilidad o salario minimo.
17. ortodoxia_fiscal     reduce: relaja reglas de gasto, deficit o deuda.
                         aumenta: refuerza estabilidad presupuestaria o reduccion de deuda.
                         Sentido invertido: aqui "aumenta" es mas disciplina fiscal.
18. proteccionismo       reduce: abre mercados, elimina aranceles o barreras.
                         aumenta: impone aranceles, cuotas o barreras comerciales.
19. nacionalismo         reduce: relativiza simbolos, lengua comun o identidad nacional.
                         aumenta: refuerza simbolos, lengua comun o identidad nacional.
20. autoridad_estatal    reduce: refuerza organismos independientes o contrapesos.
                         aumenta: concentra poder en el Ejecutivo o somete organos independientes.

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
- Subir el salario minimo NO es gasto publico: es proteccion_laboral aumenta.
- Endurecer penas por conducta privada es derechos_individuales reduce; endurecer penas
  por delitos comunes es orden_publico reduce. No marques las dos por el mismo articulo.
- En las dimensiones 7 a 10, "reduce" siempre significa menos autonomia personal o menos
  pluralidad, y "aumenta" siempre lo contrario. Manten ese sentido aunque suene raro.
- Una norma puede responder distinto en cada dimension. No busques coherencia entre ellas.
- Ante la duda, "neutro". Preferimos no codificar a codificar mal.
- justificacion: una frase de maximo 15 palabras.
- Espanol de Espana. Sin adjetivos valorativos.`;
}