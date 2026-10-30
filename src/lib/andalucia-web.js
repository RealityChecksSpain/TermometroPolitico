export const TIPO_INICIATIVA = {
  PNLP: 'Proposición no de ley',
  PL: 'Proyecto de ley',
  M: 'Moción',
  CCG: 'Debate de política general',
  DL: 'Decreto ley',
  PPL: 'Proposición de ley',
  ILPA: 'Iniciativa legislativa popular',
  PPPL: 'Proposición de ley ante el Congreso',
  DG: 'Debate general',
  COM: 'Comisión o grupo de trabajo',
  CONV: 'Convenio',
  APP: 'Comparecencia'
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
