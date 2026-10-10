export const REVISADO = '2026-10-10';

const F = {
  infobaeVivienda: { fuente: 'Infobae', url: 'https://www.infobae.com/espana/2026/10/05/feijoo-anuncia-sus-propuestas-en-vivienda-de-construir-250000-casas-al-ano-a-rebajar-el-iva-al-4-para-jovenes/' },
  debateCompromisos: { fuente: 'El Debate', url: 'https://www.eldebate.com/espana/20261010/compromisos-feijoo-cara-elecciones-derogar-leyes-sanchistas-bajar-impuestos-millon-casas_466730.html' },
  forbes: { fuente: 'Forbes España', url: 'https://forbes.es/actualidad/1036705/elecciones-2026-batallas-economicas-29-n/' },
  infobaeSanchez: { fuente: 'Infobae', url: 'https://www.infobae.com/espana/2026/10/10/el-psoe-abre-la-precampana-para-el-29n-con-sanchez-como-un-perro-que-no-tiene-amo-y-promete-que-la-politica-de-vivienda-no-tiene-fecha-de-caducidad/' },
  euronewsSanchez: { fuente: 'Euronews', url: 'https://es.euronews.com/2026/10/10/sanchez-abre-la-campana-electoral-del-29n-en-su-ciudad-talisman-con-la-vivienda-como-eje-p' },
  mundiarioVox: { fuente: 'Mundiario', url: 'https://www.mundiario.com/articulo/politica/programa-maximos-vox-29-n-abascal-impone-lineas-rojas-feijoo/20261006031035445119.html' },
  moncloaSmi: { fuente: 'Moncloa.com', url: 'https://moncloa.com/2026/10/08/salario-minimo-expertos-diaz-sumar-3444498' },
  orainFrente: { fuente: 'Orain', url: 'https://orain.eus/es/politica/2026/10/04/sumar-fija-el-17-octubre-lanzar-el-frente-amplio-su-candidatura/' },
  moncloaBildu: { fuente: 'Moncloa.com', url: 'https://www.moncloa.com/2026/10/05/eh-bildu-elecciones-generales-29n-3443002/' },
  eldiarioErcJunts: { fuente: 'elDiario.es', url: 'https://www.eldiario.es/catalunya/29n-obliga-junts-erc-redefinir-reloj-estrategias-electorales_1_13562051.html' },
  diarioRedPodemos: { fuente: 'Diario Red', url: 'https://www.diario-red.com/articulo/espana/irene-montero-propone-primarias-abiertas-14-15-octubre-desbloquear-formacion-candidatura-izquierdas-1/20261005112109077691.html' }
};

export const DECLARACIONES = {
  PP: {
    estado: 'Sin programa electoral todavía. Medidas anunciadas por Alberto Núñez Feijóo y en el decálogo económico del partido.',
    puntos: [
      { texto: 'Construir 250.000 viviendas al año, un millón en cuatro años.', fecha: '2026-10-05', filtros: [], ...F.infobaeVivienda },
      { texto: 'Bajar al 4 % el IVA de la vivienda para jóvenes y bajar el impuesto de transmisiones en la compra de vivienda.', fecha: '2026-10-05', filtros: ['impuestos:reduce'], ...F.infobaeVivienda },
      { texto: 'Aval público de hasta el 100 % del precio para la compra de vivienda de los jóvenes.', fecha: '2026-10-05', filtros: ['gasto_publico:aumenta'], ...F.infobaeVivienda },
      { texto: 'Conceder las licencias de obra por silencio administrativo si el ayuntamiento no responde en 90 días.', fecha: '2026-10-05', filtros: ['regulacion_mercado:reduce'], ...F.infobaeVivienda },
      { texto: 'Deflactar el IRPF estatal, IVA del 0 % para alimentos básicos y bajar el de la energía del 21 % al 10 %.', fecha: '2026-09', filtros: ['impuestos:reduce'], ...F.debateCompromisos },
      { texto: 'Suprimir las zonas tensionadas de alquiler.', fecha: '2026-09', filtros: ['regulacion_mercado:reduce'], ...F.debateCompromisos },
      { texto: 'Sobre Ceuta: «la única solución es que los 15.000 se vayan de Ceuta y de España», en referencia a quienes entraron de forma irregular.', fecha: '2026-10-07', filtros: ['apertura_migratoria:reduce'], ...F.debateCompromisos },
      { texto: 'Alargar la vida de las centrales nucleares y suprimir el impuesto a la generación eléctrica.', fecha: '2026-09', filtros: ['impuestos:reduce'], ...F.forbes }
    ]
  },
  PSOE: {
    estado: 'Sin programa electoral todavía. Lo que Pedro Sánchez promete mantener y lo que aprobó el Congreso Federal del partido.',
    puntos: [
      { texto: 'Mantener y reforzar el decreto ley de vivienda en la próxima legislatura.', fecha: '2026-10-10', filtros: ['regulacion_mercado:aumenta'], ...F.infobaeSanchez },
      { texto: 'Préstamos a interés cero de hasta 50.000 € para la primera vivienda, con una línea de 10.000 millones del ICO.', fecha: '2026-10-10', filtros: ['gasto_publico:aumenta'], ...F.euronewsSanchez },
      { texto: 'Limitar la compra de viviendas por fondos de inversión y gravar los pisos turísticos como actividad económica.', fecha: '2026-10-10', filtros: ['regulacion_mercado:aumenta', 'impuestos:aumenta'], ...F.euronewsSanchez },
      { texto: 'Tope a las subidas del alquiler y prórroga de hasta dos años para inquilinos al corriente de pago.', fecha: '2026-10-10', filtros: ['regulacion_mercado:aumenta'], ...F.euronewsSanchez },
      { texto: 'Jornada laboral de 36 horas antes de 2030 y salario mínimo en el 60 % del salario medio.', fecha: '2026', filtros: ['proteccion_laboral:aumenta'], ...F.forbes },
      { texto: 'Empresa Estatal de Vivienda y vivienda pública por encima del 6 % del parque.', fecha: '2026', filtros: ['propiedad_publica:aumenta'], ...F.forbes }
    ]
  },
  VOX: {
    estado: 'Sin programa electoral todavía. Declaración de Santiago Abascal tras la convocatoria y propuestas de su programa económico.',
    puntos: [
      { texto: '«Prioridad nacional», «para que los españoles no estén discriminados en su propia tierra». No detalló cómo se aplicaría.', fecha: '2026-10-06', filtros: ['apertura_migratoria:reduce'], ...F.mundiarioVox },
      { texto: '«Remigración», «para revertir la invasión migratoria». No detalló medidas.', fecha: '2026-10-06', filtros: ['apertura_migratoria:reduce'], ...F.mundiarioVox },
      { texto: 'Desregular la economía, «para quitarle […] todo el ánimo confiscatorio».', fecha: '2026-10-06', filtros: ['regulacion_mercado:reduce'], ...F.mundiarioVox },
      { texto: 'Bajar el IRPF y el IVA y fijar el impuesto de sociedades en el 15 %.', fecha: '2026', filtros: ['impuestos:reduce'], ...F.forbes },
      { texto: 'Suprimir la cuota de autónomos para quien gane menos del salario mínimo.', fecha: '2026', filtros: ['impuestos:reduce'], ...F.forbes },
      { texto: 'Rechaza reducir la jornada laboral por ley.', fecha: '2026', filtros: [], ...F.forbes }
    ]
  },
  SUMAR: {
    estado: 'En 2026 se presenta como Frente Amplio; su candidatura y su hoja de ruta se presentan el 17 de octubre. Hasta entonces, sus posiciones conocidas, sin cifras.',
    puntos: [
      { texto: 'Más protección a los inquilinos, prórrogas de alquiler más largas y límites a los usos especulativos de la vivienda.', fecha: '2026', filtros: ['regulacion_mercado:aumenta'], ...F.forbes },
      { texto: 'Más impuestos a las grandes herencias y fortunas.', fecha: '2026', filtros: ['impuestos:aumenta'], ...F.forbes },
      { texto: 'Reducir la jornada y subir el salario mínimo; quiere cerrar la subida de 2027 antes del 29 de noviembre.', fecha: '2026-10-08', filtros: ['proteccion_laboral:aumenta'], ...F.moncloaSmi },
      { texto: 'En contra de alargar algunas centrales nucleares; apuesta por renovables y almacenamiento.', fecha: '2026', filtros: ['medio_ambiente:aumenta'], ...F.forbes }
    ],
    fuenteEstado: F.orainFrente
  },
  PODEMOS: {
    estado: 'En 2023 se presentó dentro de Sumar. Para 2026 ha ofrecido a Sumar unas primarias abiertas los días 14 y 15 de octubre. Prioridades anunciadas por Irene Montero para un primer año de legislatura.',
    soloDeclaraciones: true,
    nombre: 'Podemos',
    color: '#6B2C91',
    puntos: [
      { texto: 'Jornada laboral de 35 horas y salario mínimo de 1.800 € al mes.', fecha: '2026', filtros: ['proteccion_laboral:aumenta'], ...F.forbes },
      { texto: 'Regular los precios de la vivienda, sobre todo los alquileres.', fecha: '2026', filtros: ['regulacion_mercado:aumenta'], ...F.forbes },
      { texto: 'Más impuestos a grandes empresas y fortunas, y a los beneficios extraordinarios.', fecha: '2026', filtros: ['impuestos:aumenta'], ...F.forbes },
      { texto: 'Crear una empresa pública de energía.', fecha: '2026', filtros: ['propiedad_publica:aumenta'], ...F.forbes },
      { texto: 'Propone a Sumar primarias abiertas el 14 y el 15 de octubre para una candidatura común.', fecha: '2026-10-05', filtros: [], ...F.diarioRedPodemos }
    ]
  },
  'EH BILDU': {
    estado: 'Sin propuestas concretas todavía. Pone la vivienda como eje de campaña, sin medidas detalladas.',
    puntos: [
      { texto: '«Este país necesita un nuevo estatus, haya o no elecciones», y seguir avanzando en la plurinacionalidad.', fecha: '2026-10-05', filtros: ['descentralizacion:aumenta'], ...F.moncloaBildu }
    ]
  },
  ERC: {
    estado: 'Sin propuestas nuevas para el 29 de noviembre. Gabriel Rufián pedirá «un mínimo de condiciones» a su partido antes de repetir como candidato.',
    puntos: [],
    fuenteEstado: F.eldiarioErcJunts
  },
  JUNTS: {
    estado: 'Sin propuestas publicadas para el 29 de noviembre. Repite Míriam Nogueras como candidata.',
    puntos: [],
    fuenteEstado: F.eldiarioErcJunts
  }
};

export const SIN_DATOS = 'Aún no hemos encontrado propuestas concretas para el 29 de noviembre.';

export function declaracionesDe(siglas) {
  return DECLARACIONES[siglas] ?? null;
}

export function partidosSoloDeclaraciones() {
  return Object.entries(DECLARACIONES)
    .filter(([, d]) => d.soloDeclaraciones)
    .map(([siglas, d]) => ({ siglas, nombre: d.nombre, color: d.color, soloDeclaraciones: true }));
}
