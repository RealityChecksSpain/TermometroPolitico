import { QUE_ES } from './fraseCorta.js';

const PROPIOS = {
  patrimonioLiquido: 'Dinero en cuentas, valores y planes de pensiones, menos las deudas. No incluye casas ni coches: la declaración no pone su valor.',
  inmueblesEquivalentes: 'Cada inmueble cuenta por el porcentaje que se declara poseer: media casa cuenta como 0,5. Las partes declaradas sin porcentaje no suman, así que la cifra es un mínimo.',
  viaSociedad: 'El inmueble está a nombre de una empresa del diputado, no directamente al suyo.',
  bienPropio: 'Está a nombre del diputado, solo o compartido con otras personas.',
  origenSinDesglosar: 'Esa declaración no separa lo propio de lo que está en una sociedad, así que no consta de cuál es.',
  nudaPropiedad: 'Es el dueño, pero otra persona puede usarlo o cobrar su alquiler. Habitual en herencias.',
  pactoSucesorio: 'Una herencia entregada en vida. Habitual en Galicia, País Vasco, Cataluña, Navarra y Baleares.',
  comunidadBienes: 'El bien es de varias personas, sin ninguna empresa de por medio.',
  ausencia: 'Una votación en la que no emitió voto. Votar a distancia por baja o embarazo sí cuenta como voto emitido.',
  disciplina: 'Cuántas veces de cada 100 votó lo mismo que la mayoría de su grupo.',
  disidencia: 'Votó distinto que la mayoría de su grupo.',
  abstencion: 'Voto emitido que no es ni a favor ni en contra. No es una ausencia.',
  materia: 'El tema de la norma. No lo publica el Congreso: lo asigna un modelo de lenguaje leyendo el texto.',
  resumenIA: 'Lo escribe un modelo de lenguaje a partir del texto oficial. Cada ficha dice de dónde sale.',
  confianza: 'Cómo de limpia salió la lectura del PDF. Las de confianza baja no entran en los hallazgos.',
  ejes: 'Las posiciones de los partidos las calcula esta web. «Lo que prometieron» sale de codificar con un modelo de lenguaje cada promesa del programa; «Lo que han votado» y «Territorialidad», de codificar cada ley y contar cuáles apoyó cada partido. Las preguntas son de hecho: ¿sube o baja el gasto? Solo la «Comparativa externa» viene de fuera: encuestas de expertos, con su fuente citada.',
  promesaCumplida: 'Votó en el pleno lo que prometió y la iniciativa salió adelante en la votación que la aprueba: la final de una ley, la convalidación de un decreto o la autorización de un tratado. Si la apoyó y no salió, cuenta como «la apoyó, no salió».',
  promesaNoDecisiva: 'Votó a favor de lo que prometió y la votación salió, pero esa votación no aprueba ninguna norma: la toma en consideración de una ley, que solo la admite a trámite, una proposición no de ley, una moción, la creación de una subcomisión o un trámite como la tramitación por urgencia. No cuenta como cumplida.',
  promesaContradicha: 'Votó en el pleno lo contrario de lo que prometió.',
  buscador: 'Escribe cómo vives («soy autónoma y vivo de alquiler») y salen las leyes que te tocan. No guarda nada.',
  ultimasLeyes: 'Lo último votado en el Congreso, de más reciente a más antiguo: en el Pleno o, con las Cortes disueltas, en la Diputación Permanente. Si una norma tiene varias votaciones y no consta cuál fue la final, pone «Última» y el resultado de la última votación registrada.',
  hallazgos: 'Cifras sacadas de cruzar votos, declaraciones de bienes y programas. Debajo pone sobre cuántos casos se calcula cada una.',
  filtroColectivo: 'Haz clic en una etiqueta y la lista se queda con las leyes que afectan a ese colectivo. El número es cuántas hay.',
  hemiciclo: 'Los 350 escaños colocados como en la sala, por partido. En una votación abierta cada escaño muestra su voto.',
  franjaVotos: 'El reparto del voto: verde a favor, rojo en contra, amarillo abstención. El tramo ganador sobresale.',
  salvedad: 'Un error de las cuentas lo bastante grande como para que el Tribunal de Cuentas lo señale en su opinión.',
  posibleInfraccion: 'El Tribunal de Cuentas dice que podría ser una infracción de la ley de financiación de los partidos, que se castiga con multa. Para multar abre un procedimiento aparte.'
};

export const GLOSARIO = { ...QUE_ES, ...PROPIOS };

export function textoGlosario(clave) {
  if (!clave) return null;
  return GLOSARIO[clave] ?? null;
}