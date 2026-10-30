export const TIPO_INICIATIVA = {
  PNLP: 'Proposición no de ley',
  PL: 'Proyecto de ley',
  M: 'Moción',
  CCG: 'Comunicación del Gobierno andaluz',
  DL: 'Decreto ley',
  PPL: 'Proposición de ley',
  ILPA: 'Iniciativa legislativa popular o municipal',
  PPPL: 'Proposición de ley ante el Congreso',
  DG: 'Debate general',
  COM: 'Comisión o grupo de trabajo',
  CONV: 'Convenio',
  APP: 'Comparecencia',
  ICG: 'Informe de la Cuenta General',
  OAPP: 'Otro asunto en Pleno',
  CSRT: 'Carta de servicio público de la RTVA',
  MUGP: 'Municipio de gran población'
};

export const SENTIDO = {
  si: { texto: 'Sí', color: '#1F7A45' },
  no: { texto: 'No', color: '#B23A2E' },
  abstencion: { texto: 'Abstención', color: '#C9962A' },
  blanco: { texto: 'En blanco', color: '#8E9299' },
  ausente: { texto: 'Ausente', color: '#C9CDD2' }
};

const PROPIOS = ['Andalucía', 'España', 'Junta', 'Gobierno', 'Estado', 'Europa', 'Unión Europea', 'Sevilla', 'Málaga', 'Cádiz', 'Córdoba',
  'Granada', 'Huelva', 'Jaén', 'Almería', 'Ceuta', 'Melilla', 'Gibraltar', 'Marruecos', 'Israel', 'Palestina', 'Gaza', 'Doñana',
  'Constitución', 'Estatuto', 'Parlamento', 'Consejo de Gobierno', 'Tribunal Constitucional', 'Seguridad Social', 'Guadalquivir'];

export function tituloLegible(v) {
  const bruto = String(v?.titulo_general ?? '').replace(/^\d{1,2}-\d{2}\/[A-Z]+-\d+[,.]\s*/, '').trim();
  if (!bruto) return 'Votación sin título';
  let t = bruto.toLowerCase();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  for (const p of PROPIOS) t = t.replace(new RegExp(`\\b${p.toLowerCase()}\\b`, 'g'), p);
  return t;
}

export function fechaCorta(iso) {
  return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
}

export function coincidencias(votaciones) {
  const pares = new Map();
  for (const v of votaciones) {
    const g = v.voto_grupos ?? {};
    const siglas = Object.keys(g).filter(s => g[s] && g[s] !== 'ausente').sort();
    for (let i = 0; i < siglas.length; i++) {
      for (let j = i + 1; j < siglas.length; j++) {
        const k = `${siglas[i]}|${siglas[j]}`;
        const p = pares.get(k) ?? { a: siglas[i], b: siglas[j], total: 0, iguales: 0 };
        p.total++;
        if (g[siglas[i]] === g[siglas[j]]) p.iguales++;
        pares.set(k, p);
      }
    }
  }
  return [...pares.values()].map(p => ({ ...p, pct: p.total ? Math.round((100 * p.iguales) / p.total) : null }));
}

export function media(xs) {
  const v = xs.filter(x => x != null && Number.isFinite(Number(x))).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function mediana(xs) {
  const v = xs.filter(x => x != null && Number.isFinite(Number(x))).map(Number).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function euros(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` : null;
}

export function decimal(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

export function etiquetaLegislatura(legislatura) {
  return Number(legislatura) === 13
    ? { corta: 'Nueva', larga: 'Legislatura nueva · desde 2026' }
    : { corta: 'Anterior', larga: 'Legislatura anterior · 2022-2026' };
}

const PROPONENTES = [
  [/popular/i, 'PP'],
  [/socialista/i, 'PSOE-A'],
  [/vox/i, 'VOX'],
  [/adelante/i, 'ADELANTE ANDALUCÍA'],
  [/por andaluc/i, 'POR ANDALUCÍA'],
  [/consejo de gobierno/i, 'Gobierno andaluz']
];

export function autoresDe(proponente) {
  const salida = [];
  for (const trozo of String(proponente ?? '').split(/,|\sy\s/)) {
    const t = trozo.trim();
    if (!t) continue;
    const hallado = PROPONENTES.find(([re]) => re.test(t));
    const nombre = hallado ? hallado[1] : t;
    if (!salida.includes(nombre)) salida.push(nombre);
  }
  return salida;
}

export function listaHumana(xs) {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

export const ES_LEY = new Set(['PL', 'PPL', 'ILPA', 'DL']);

export const QUE_ES_TIPO = {
  PNLP: 'Una proposición no de ley es una petición política: el Parlamento pide o insta a un Gobierno a hacer algo. No cambia por sí sola ninguna norma.',
  M: 'Una moción es una petición política que sale de una interpelación al Gobierno. No cambia por sí sola ninguna norma.',
  PL: 'Un proyecto de ley lo presenta el Gobierno andaluz. Si el Parlamento lo aprueba, es ley en Andalucía.',
  PPL: 'Una proposición de ley la presentan los grupos parlamentarios. Si el Parlamento la aprueba, es ley en Andalucía.',
  ILPA: 'Es una iniciativa legislativa que presentan los ciudadanos con firmas o los ayuntamientos. Si el Parlamento la aprueba, es ley en Andalucía.',
  DL: 'Un decreto ley lo aprueba el Gobierno andaluz por urgencia y el Parlamento lo convalida o lo deroga.',
  PPPL: 'Es una proposición de ley que el Parlamento de Andalucía envía al Congreso de los Diputados: allí se decide si sale adelante.',
  COM: 'Es la creación de una comisión, un grupo de trabajo o una ponencia de estudio en el Parlamento.',
  DG: 'Es un debate general en el Pleno sobre un asunto.',
  CCG: 'Es una comunicación del Gobierno andaluz que se debate en el Pleno. Los grupos votan propuestas de resolución.',
  ICG: 'Es el informe de la Cámara de Cuentas sobre las cuentas de la Junta de Andalucía de un año. Los grupos votan propuestas de resolución.'
};
