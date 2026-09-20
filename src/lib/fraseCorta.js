const ARRANQUE_VACIO = /^\s*(?:la\s+(?:norma|ley|proposici[oó]n|iniciativa)\s+)?(?:se\s+)?(?:regula|establece|aprueba|dispone|contempla|recoge)\s+(?:que\s+)?/i;

const ABREVIATURAS = [
  'art', 'arts', 'apdo', 'apdos', 'cap', 'caps', 'núm', 'num', 'pág', 'pags', 'págs',
  'sr', 'sra', 'srs', 'sras', 'dª', 'd', 'dña', 'ud', 'uds', 'etc', 'aprox',
  'ss', 'vid', 'op', 'cit', 'ej', 'p', 'nº', 'no', 'lo', 'ldo', 'ref'
];

const CIERRE_ABREVIATURA = new RegExp(
  `(?:\\b(?:${ABREVIATURAS.join('|')})|\\b[A-ZÁÉÍÓÚÑ]|\\b\\d{1,2})\\.$`,
  'i'
);

const QUE_ES = {
  decretoLey: 'El Gobierno la aprobó por urgencia y ya estaba en vigor al votarse. El Congreso solo decide si la mantiene o la deroga.',
  legislativo: 'Texto refundido que el Gobierno aprueba por delegación de las Cortes.',
  proyecto: 'Ley propuesta por el Gobierno.',
  proposicion: 'Ley propuesta por los grupos parlamentarios o por una asamblea autonómica.',
  organica: 'Ley orgánica: regula derechos fundamentales o instituciones básicas y necesita mayoría absoluta.',
  conjunto: 'Votación final del conjunto de una ley orgánica. Sale adelante solo con mayoría absoluta del Congreso.',
  constitucion: 'Cambia el texto de la Constitución. Exige mayorías reforzadas y, según el artículo afectado, referéndum.',
  reglamento: 'Cambia las normas internas de funcionamiento del Congreso.',
  pnl: 'Pide al Gobierno que haga algo. No lo obliga: no tiene fuerza de ley.',
  mocion: 'Pide al Gobierno que haga algo tras una interpelación. No lo obliga.',
  interpelacion: 'Pregunta formal al Gobierno sobre su política general. No crea ninguna norma.',
  enmienda: 'Cambio sobre un texto que ya está en tramitación.',
  dictamen: 'Texto que sale de la comisión y pasa al Pleno.',
  estatuto: 'Asunto interno de la Cámara sobre la situación de los diputados, no legislación.',
  convalidacion: 'El Congreso decide si mantiene en vigor un decreto-ley del Gobierno.',
  tratado: 'El Congreso autoriza al Gobierno a obligarse. Una vez ratificado, forma parte del derecho español.',
  acuerdoGobierno: 'Decisión del Gobierno que el Congreso aprueba o rechaza, como la senda de déficit.',
  tramite: 'Trámite interno del Pleno: no crea ni cambia ninguna norma.',
  informe: 'Informe de una comisión o subcomisión sometido al Pleno.',
  instaGobierno: 'Pide al Gobierno que actúe. No lo obliga: no tiene fuerza de ley.'
};

const VEHICULOS = [
  { patron: /^\s*real\s+decreto[-\s]?ley(?:\s+\d+\/\d+)?/i, nombre: 'Real Decreto-ley', fuerzaDeLey: true, queEs: QUE_ES.decretoLey },
  { patron: /^\s*real\s+decreto\s+legislativo(?:\s+\d+\/\d+)?/i, nombre: 'Real Decreto Legislativo', fuerzaDeLey: true, queEs: QUE_ES.legislativo },
  { patron: /^\s*convalidaci[óo]n/i, nombre: 'Convalidación', fuerzaDeLey: true, queEs: QUE_ES.convalidacion },
  { patron: /reforma\s+del\s+art[íi]culo\s+\d+\s+de\s+la\s+constituci[óo]n/i, nombre: 'Reforma de la Constitución', fuerzaDeLey: true, queEs: QUE_ES.constitucion },
  { patron: /reforma\s+del\s+reglamento\s+del\s+congreso/i, nombre: 'Reforma del Reglamento', fuerzaDeLey: true, queEs: QUE_ES.reglamento },
  { patron: /^\s*reforma\s+del\s+reglamento/i, nombre: 'Reforma del Reglamento', fuerzaDeLey: true, queEs: QUE_ES.reglamento, conservar: true },
  { patron: /^\s*votaci[óo]n\s+de\s+conjunto/i, nombre: 'Votación de conjunto', fuerzaDeLey: true, queEs: QUE_ES.conjunto },
  { patron: /^\s*proyecto\s+de\s+ley\s+org[áa]nica/i, nombre: 'Proyecto de Ley Orgánica', fuerzaDeLey: true, queEs: QUE_ES.organica },
  { patron: /^\s*proyecto\s+de\s+ley/i, nombre: 'Proyecto de Ley', fuerzaDeLey: true, queEs: QUE_ES.proyecto },
  { patron: /^\s*proposici[óo]n\s+de\s+ley\s+org[áa]nica/i, nombre: 'Proposición de Ley Orgánica', fuerzaDeLey: true, queEs: QUE_ES.organica },
  { patron: /^\s*proposici[óo]n\s+no\s+de\s+ley/i, nombre: 'Proposición no de Ley', fuerzaDeLey: false, queEs: QUE_ES.pnl },
  { patron: /^\s*proposici[óo]n\s+de\s+ley/i, nombre: 'Proposición de Ley', fuerzaDeLey: true, queEs: QUE_ES.proposicion },
  { patron: /^\s*moci[óo]n\s+consecuencia\s+de\s+interpelaci[óo]n(?:\s+urgente)?/i, nombre: 'Moción', fuerzaDeLey: false, queEs: QUE_ES.mocion },
  { patron: /^\s*moci[óo]n/i, nombre: 'Moción', fuerzaDeLey: false, queEs: QUE_ES.mocion },
  { patron: /^\s*interpelaci[óo]n(?:\s+urgente)?/i, nombre: 'Interpelación', fuerzaDeLey: false, queEs: QUE_ES.interpelacion },
  { patron: /^\s*enmiendas?\s+al\s+(?:acuerdo|convenio|tratado|protocolo)/i, nombre: 'Tratado internacional', fuerzaDeLey: true, queEs: QUE_ES.tratado, conservar: true },
  { patron: /^\s*enmiendas?(?:\s+del\s+senado)?/i, nombre: 'Enmienda', fuerzaDeLey: true, queEs: QUE_ES.enmienda },
  { patron: /^\s*dictamen\s+de\s+la\s+comisi[óo]n\s+del\s+estatuto/i, nombre: 'Dictamen del Estatuto', fuerzaDeLey: false, queEs: QUE_ES.estatuto, conservar: true },
  { patron: /^\s*dictamen(?:\s+de\s+la\s+comisi[óo]n)?/i, nombre: 'Dictamen', fuerzaDeLey: true, queEs: QUE_ES.dictamen },
  { patron: /^\s*acuerdo\s+del\s+gobierno/i, nombre: 'Acuerdo del Gobierno', fuerzaDeLey: false, queEs: QUE_ES.acuerdoGobierno, conservar: true },
  { patron: /^\s*(?:tratado|convenci[óo]n|convenio|protocolo)\b/i, nombre: 'Tratado internacional', fuerzaDeLey: true, queEs: QUE_ES.tratado, conservar: true },
  { patron: /^\s*acuerdo\b(?!\s+del\s+gobierno)/i, nombre: 'Tratado internacional', fuerzaDeLey: true, queEs: QUE_ES.tratado, conservar: true },
  { patron: /^\s*canje\s+de\s+notas/i, nombre: 'Tratado internacional', fuerzaDeLey: true, queEs: QUE_ES.tratado, conservar: true },
  { patron: /^\s*actas\s+del\b/i, nombre: 'Tratado internacional', fuerzaDeLey: true, queEs: QUE_ES.tratado, conservar: true },
  { patron: /^\s*declaraciones\s+relativas\b/i, nombre: 'Tratado internacional', fuerzaDeLey: true, queEs: QUE_ES.tratado, conservar: true },
  { patron: /^\s*solicitud\s+de\s+avocaci[óo]n/i, nombre: 'Trámite del Pleno', fuerzaDeLey: false, queEs: QUE_ES.tramite, conservar: true },
  { patron: /^\s*solicitud\s+de[ls]?\b/i, nombre: 'Trámite del Pleno', fuerzaDeLey: false, queEs: QUE_ES.tramite, conservar: true },
  { patron: /^\s*propuesta\s+de[ls]?\b/i, nombre: 'Trámite del Pleno', fuerzaDeLey: false, queEs: QUE_ES.tramite, conservar: true },
  { patron: /^\s*daci[óo]n\s+de\s+cuentas/i, nombre: 'Trámite del Pleno', fuerzaDeLey: false, queEs: QUE_ES.tramite, conservar: true },
  { patron: /^\s*informe\s+de[ls]?\b/i, nombre: 'Informe', fuerzaDeLey: false, queEs: QUE_ES.informe, conservar: true },
  { patron: /^\s*relativ[ao]\s+a\b/i, nombre: 'Iniciativa no legislativa', fuerzaDeLey: false, queEs: QUE_ES.instaGobierno, conservar: true }
];

const CONECTOR_INICIAL = /^(?:[\s,;:.\-–—]*)(?:org[áa]nica\s+)?(?:por\s+(?:el|la|los|las)\s+(?:que|cual)\s+se\s+|por\s+(?:el|la|los|las)\s+(?:que|cual)\s+|de\s+|del\s+|relativ[ao]\s+a\s+(?:la\s+|el\s+|los\s+|las\s+)?|sobre\s+(?:la\s+|el\s+|los\s+|las\s+)?|en\s+materia\s+de\s+|para\s+)/i;

const FECHA_INICIAL = /^[\s,;:.\-–—]*de\s+\d{1,2}\s+de\s+[a-záéíóúñ]+(?:\s+de\s+\d{4})?[\s,;:.\-–—]*/i;

const TEMA = '(?:sobre|relativ[ao]s?\\s+a|para|en\\s+materia\\s+de|por\\s+l[ao]s?\\s+(?:que|cual)|de\\s+(?:reforma|creaci[óo]n|modificaci[óo]n|derogaci[óo]n))';

const AUTORIA = [
  new RegExp(`^\\s*(?:proposici[óo]n|propuesta|solicitud|informe|dictamen)\\b[^,]{0,110},\\s*(?=${TEMA}\\b)`, 'i'),
  new RegExp(`^[\\s,;:.\\-–—]*(?:de\\s+l[oa]s?|del|de)\\s+(?:grupos?\\s+parlamentarios?|comisi[óo]n|subcomisi[óo]n|sr\\.?|sra\\.?|diputad[oa]s?)[^,]{0,110},\\s*(?=${TEMA}\\b)`, 'i'),
  new RegExp(`^[\\s,;:.\\-–—]*(?:de\\s+l[oa]s?|del|de)\\s+grupos?\\s+parlamentarios?\\s+[\\s\\S]*?(?=\\b${TEMA}\\b)`, 'i')
];

const ARTICULO_INICIAL = /^(?:los|las|el|la)\s+/i;

const COLA_LUGAR = /[,;]\s*(?:hech[oa]s?|adoptad[oa]s?|firmad[oa]s?|suscrit[oa]s?)\s+en\s+[\s\S]*$/i;

const RELLENO_INICIAL = [
  /^\s*proposici[óo]n\s+de\s+ley\s+presentada\s+por\s+el\s+grupo\s+parlamentario\s+de\s+\S+\s*[:.\-–—]?\s*/i,
  /^\s*presentada\s+por\s+el\s+grupo\s+parlamentario\s+(de\s+)?[^.:\-–—]+[:.\-–—]\s*/i,
  /^\s*del\s+grupo\s+parlamentario\s+[^.:\-–—]{3,60}?[,:]\s*/i
];

export function partirFrases(texto) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return [];
  const crudas = limpio.split(/(?<=[.!?])\s+(?=[«"(¿¡A-ZÁÉÍÓÚÑ0-9])/);
  const salida = [];
  for (const trozo of crudas) {
    const previa = salida[salida.length - 1];
    if (previa && CIERRE_ABREVIATURA.test(previa)) salida[salida.length - 1] = `${previa} ${trozo}`;
    else salida.push(trozo);
  }
  return salida.map(f => f.trim()).filter(Boolean);
}

export function recortarEnPalabra(texto, max) {
  const t = String(texto ?? '').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const i = corte.lastIndexOf(' ');
  const base = (i > Math.min(18, max * 0.5) ? corte.slice(0, i) : corte).trim();
  return `${base.replace(/[,;:.\-–—]+$/, '')}…`;
}

export function limpiarFrase(texto, max = 48) {
  if (!texto) return null;
  let t = String(texto).replace(/\s+/g, ' ').trim();
  t = partirFrases(t)[0] ?? t;
  t = t.replace(/\.$/, '').trim();
  t = t.replace(ARRANQUE_VACIO, '').trim();
  if (!t) return null;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length <= max) return t;
  return recortarEnPalabra(t, max);
}

export function nombreOficialNorma(n) {
  const crudo = n?.titular || n?.subtitulo || n?.titulo || '';
  let t = String(crudo).replace(/\s+/g, ' ').trim();
  for (const patron of RELLENO_INICIAL) t = t.replace(patron, '').trim();
  return t || String(crudo).trim();
}

function entradaVehiculo(oficial) {
  for (const v of VEHICULOS) {
    if (v.patron.test(oficial)) return v;
  }
  return null;
}

export function nombreCompletoNorma(n) {
  const candidatos = [n?.titular, n?.titulo, n?.subtitulo]
    .map(t => String(t ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!candidatos.length) return '';
  return candidatos.reduce((a, b) => (b.length > a.length ? b : a));
}

export function vehiculoNorma(n) {
  const oficial = nombreOficialNorma(n);
  if (!oficial) return null;
  const v = entradaVehiculo(oficial);
  return v ? { nombre: v.nombre, fuerzaDeLey: v.fuerzaDeLey, queEs: v.queEs } : null;
}

export function queEsNorma(n) {
  return vehiculoNorma(n)?.queEs ?? null;
}

function despejar(texto, conAutoria) {
  const entrada = entradaVehiculo(texto);
  let t = String(texto ?? '').trim();
  if (entrada && !entrada.conservar) {
    const m = entrada.patron.exec(t);
    if (m && m.index === 0) t = t.slice(m[0].length);
  }
  t = t.replace(COLA_LUGAR, '').trim();
  t = t.replace(FECHA_INICIAL, '').trim();
  let quitadaAutoria = false;
  if (conAutoria) {
    for (const patron of AUTORIA) {
      const antes = t;
      t = t.replace(patron, '').trim();
      if (t !== antes) { quitadaAutoria = true; break; }
    }
  }
  if (!entrada || !entrada.conservar || quitadaAutoria) {
    t = t.replace(CONECTOR_INICIAL, '').trim();
    t = t.replace(ARTICULO_INICIAL, '').trim();
  }
  return t.replace(/^[\s,;:.\-–—]+/, '').trim();
}

export function tituloCorto(n, max = 120) {
  const oficial = nombreOficialNorma(n);
  if (!oficial) return '';
  const limpio = despejar(oficial, true);
  const medio = despejar(oficial, false);
  let cuerpo = limpio.length > 16 ? limpio : medio.length > 24 ? medio : oficial;
  cuerpo = cuerpo.charAt(0).toUpperCase() + cuerpo.slice(1);
  if (cuerpo.length <= max) return cuerpo;
  const coma = cuerpo.lastIndexOf(',', max);
  if (coma > Math.max(40, max * 0.55)) return cuerpo.slice(0, coma).trim();
  return recortarEnPalabra(cuerpo, max);
}

export function fraseCortaDeNorma(n, max = 48) {
  const propia = n?.frase_corta || n?.en_una_frase || n?.titular_corto;
  const limpia = limpiarFrase(propia, max);
  if (limpia) return limpia;

  const frases = partirFrases(n?.resumen);
  const primera = frases[0];
  if (primera) {
    const candidata = limpiarFrase(primera, max);
    if (candidata && !candidata.endsWith('…')) return candidata;
  }
  return null;
}

export function titularDeNorma(n, max = 110) {
  return fraseCortaDeNorma(n, max) || tituloCorto(n, max);
}

export function resumenBreve(n, frases = 2) {
  const partes = partirFrases(n?.resumen);
  if (!partes.length) return null;
  return partes.slice(0, frases).join(' ');
}

export function restoResumen(n, desde = 2) {
  const partes = partirFrases(n?.resumen);
  if (partes.length <= desde) return null;
  return partes.slice(desde).join(' ');
}

export function procedenciaResumen(n) {
  if (!n?.resumen) return null;
  const modelo = n.resumen_modelo ? `por ${n.resumen_modelo}` : 'por un modelo de lenguaje';
  const base = n.resumen_basado_en === 'texto_bocg'
    ? ', a partir del texto publicado en el BOCG, anterior a las enmiendas'
    : n.resumen_basado_en
      ? ', a partir del título oficial: el Congreso no publica el texto de esta votación'
      : '';
  const revision = n.resumen_revisado === true
    ? ' Revisado a mano.'
    : ' Nadie lo ha revisado a mano.';
  return `Resumen generado automáticamente ${modelo}${base}.${revision} No sustituye al texto legal.`;
}