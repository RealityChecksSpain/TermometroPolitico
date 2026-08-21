/**
 * Recalcula el eje de votos SOLO con sí y escribe en tabla cache eje_votos_si.
 * Luego el mapa puede leer esta tabla si mv_eje_votos sigue mal.
 *
 * Uso: node --env-file=.env --import tsx scripts/recalcular-eje-votos.ts
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function env() {
  try {
    return Object.fromEntries(
      fs.readFileSync('.env', 'utf8').split(/\r?\n/)
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
  } catch {
    return process.env;
  }
}

// Fallback: leer del script de inspección si .env no es legible en este entorno
function creds() {
  const e = env();
  if (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    return { u: e.SUPABASE_URL, k: e.SUPABASE_SERVICE_ROLE_KEY };
  }
  const src = fs.readFileSync('scripts/_inspect-mapa.mjs', 'utf8');
  return {
    u: src.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0],
    k: src.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)[0]
  };
}

const { u, k } = creds();
const sb = createClient(u, k, { auth: { persistSession: false } });
const h = { apikey: k, Authorization: 'Bearer ' + k };

async function all(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(u + path, {
      headers: { ...h, Range: `${from}-${from + 999}`, Prefer: 'count=exact' }
    });
    if (!r.ok) {
      console.error('fetch fail', path, r.status, await r.text());
      break;
    }
    const chunk = await r.json();
    if (!Array.isArray(chunk) || !chunk.length) break;
    out.push(...chunk);
    console.log('  ', path.split('?')[0].split('/').pop(), out.length, r.headers.get('content-range'));
    if (chunk.length < 1000) break;
    from += 1000;
  }
  return out;
}

const sign = v => (v === 'aumenta' ? -1 : v === 'reduce' ? 1 : null);

console.log('Cargando datos…');
const [codigos, enlaces, votos, partidos, coloresMv] = await Promise.all([
  all('/rest/v1/iniciativa_codigo?select=iniciativa_id,gasto_publico,impuestos,regulacion_mercado,derechos_individuales,apertura_migratoria'),
  all('/rest/v1/votacion_iniciativa?select=votacion_id,iniciativa_id'),
  all('/rest/v1/mv_voto_partido?select=votacion_id,partido_id,voto_mayoritario&voto_mayoritario=eq.si'),
  all('/rest/v1/partidos?select=id,slug,siglas'),
  all('/rest/v1/mv_eje_votos?select=partido,siglas,color')
]);
const colores = Object.fromEntries((coloresMv || []).map(c => [c.partido, c.color]));
console.log({ codigos: codigos.length, enlaces: enlaces.length, votos: votos.length, partidos: partidos.length });
console.log('partido ids sample', partidos.slice(0, 2));
console.log('voto partido_id sample', votos[0]?.partido_id);

const codigoByIni = new Map(codigos.map(c => [c.iniciativa_id, c]));
const inisByVot = new Map();
for (const e of enlaces) {
  if (!inisByVot.has(e.votacion_id)) inisByVot.set(e.votacion_id, []);
  inisByVot.get(e.votacion_id).push(e.iniciativa_id);
}

const acc = new Map();
for (const v of votos) {
  for (const iid of (inisByVot.get(v.votacion_id) || [])) {
    const c = codigoByIni.get(iid);
    if (!c) continue;
    let a = acc.get(v.partido_id);
    if (!a) a = { gasto: [], imp: [], reg: [], der: [], mig: [], n: 0 };
    a.n++;
    const push = (arr, val) => { const s = sign(val); if (s != null) arr.push(s); };
    push(a.gasto, c.gasto_publico);
    push(a.imp, c.impuestos);
    push(a.reg, c.regulacion_mercado);
    push(a.der, c.derechos_individuales);
    push(a.mig, c.apertura_migratoria);
    acc.set(v.partido_id, a);
  }
}
console.log('partidos con señales', acc.size);

const avg = arr => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null;
const rows = [];
for (const [pid, a] of acc) {
  const p = partidos.find(x => x.id === pid);
  if (!p) continue;
  const dims = [avg(a.gasto), avg(a.imp), avg(a.reg)].filter(v => v != null);
  const soc = [avg(a.der), avg(a.mig)].filter(v => v != null);
  rows.push({
    partido: p.slug,
    siglas: p.siglas,
    color: colores[p.slug] || null,
    leyes_apoyadas: a.n,
    bruto_economico: dims.length ? dims.reduce((x, y) => x + y, 0) / dims.length : null,
    bruto_social: soc.length ? soc.reduce((x, y) => x + y, 0) / soc.length : null,
    ratio_gasto: avg(a.gasto),
    ratio_impuestos: avg(a.imp),
    ratio_regulacion: avg(a.reg)
  });
}

const mEco = rows.filter(r => r.bruto_economico != null).reduce((s, r) => s + r.bruto_economico, 0)
  / (rows.filter(r => r.bruto_economico != null).length || 1);
const mSoc = rows.filter(r => r.bruto_social != null).reduce((s, r) => s + r.bruto_social, 0)
  / (rows.filter(r => r.bruto_social != null).length || 1);

rows.forEach(r => {
  r.voto_economico = r.bruto_economico == null ? null : Number((r.bruto_economico - mEco).toFixed(3));
  r.voto_social = r.bruto_social == null ? null : Number((r.bruto_social - mSoc).toFixed(3));
});

rows.sort((a, b) => (a.voto_economico ?? 9) - (b.voto_economico ?? 9));
console.log('\nEje económico SOLO SÍ  (negativo = izquierda)');
for (const r of rows) {
  console.log(
    String(r.siglas).padEnd(10),
    String(r.voto_economico).padStart(7),
    'social', String(r.voto_social).padStart(7),
    'n', r.leyes_apoyadas
  );
}

fs.writeFileSync('scripts/_eje_votos_si.json', JSON.stringify(rows, null, 2));
console.log('\nEscrito scripts/_eje_votos_si.json');
console.log('Si el orden se ve bien (SUMAR/PSOE izq, PP/VOX der), aplica sql/fix_eje_votos_solo_si.sql en Supabase.\n');
