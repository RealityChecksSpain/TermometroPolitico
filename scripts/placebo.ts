import { db } from '../src/lib/supabase';

const REPS = Number(process.env.PLACEBO_REPS ?? 200);

if (REPS < 1000) {
  console.log(`\nAVISO: ${REPS} permutaciones dan una p con escalon de ${(1 / REPS).toFixed(4)}.`);
  console.log('Para comparar corridas entre si hace falta PLACEBO_REPS=5000 o mas.');
}
const MIN_LADO = 3;
const K = 2;

const EXCLUIR = new Set(
  (process.env.EXCLUIR ?? '').split(',').map(d => d.trim()).filter(Boolean)
);

const DIMS_TODAS: [string, string][] = [
  ['gasto_publico', 'economico'],
  ['impuestos', 'economico'],
  ['regulacion_mercado', 'economico'],
  ['propiedad_publica', 'economico'],
  ['proteccion_laboral', 'economico'],
  ['proteccionismo', 'economico'],
  ['derechos_individuales', 'social'],
  ['apertura_migratoria', 'social'],
  ['moral_tradicional', 'social'],
  ['religion_estado', 'social'],
  ['orden_publico', 'social'],
  ['diversidad_cultural', 'social'],
  ['nacionalismo', 'social'],
  ['autoridad_estatal', 'social'],
  ['descentralizacion', 'territorial'],
  ['integracion_europea', 'territorial']
];

const DIMS: [string, string][] = DIMS_TODAS.filter(([d]) => !EXCLUIR.has(d));

if (EXCLUIR.size) {
  console.log(`\nDimensiones excluidas: ${Array.from(EXCLUIR).join(', ')}`);
  const desconocidas = Array.from(EXCLUIR).filter(d => !DIMS_TODAS.some(([x]) => x === d));
  if (desconocidas.length) {
    console.log(`AVISO: no forman parte de ningun eje: ${desconocidas.join(', ')}`);
  }
}

type Apoyo = { partido_id: string; iniciativa_id: string; apoyo: number | null };

async function paginar<T>(consulta: (a: number, b: number) => any): Promise<T[]> {
  const tam = 1000;
  const salida: T[] = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await consulta(desde, desde + tam - 1);
    if (error) throw error;
    if (!data?.length) break;
    salida.push(...data);
    if (data.length < tam) break;
    desde += tam;
  }
  return salida;
}

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

function barajar<T>(v: T[]): T[] {
  const c = [...v];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function percentil(v: number[], p: number): number {
  const o = [...v].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.max(0, Math.round(p * (o.length - 1))))];
}

function bimodalidad(v: number[]): number {
  const n = v.length;
  if (n < 4) return 0;
  const m = media(v);
  const d = v.map(x => x - m);
  const m2 = media(d.map(x => x * x));
  if (m2 === 0) return 0;
  const g1 = media(d.map(x => x ** 3)) / m2 ** 1.5;
  const g2 = media(d.map(x => x ** 4)) / m2 ** 2 - 3;
  const den = g2 + (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return den === 0 ? 0 : (g1 * g1 + 1) / den;
}

const ultimasComunes = new Map<string, string[]>();
const ultimasFuera = new Map<string, string[]>();

function posiciones(
  eje: string,
  dirPorDim: Map<string, Map<string, string>>,
  apoyoPorPartido: Map<string, Map<string, number>>
): number[] {
  const dims = DIMS.filter(([, e]) => e === eje).map(([d]) => d);
  const sub = new Map<string, Map<string, { valor: number; peso: number }>>();

  for (const dim of dims) {
    const dirs = dirPorDim.get(dim);
    if (!dirs) continue;
    for (const [partido, apoyos] of apoyoPorPartido) {
      const r: number[] = [];
      const a: number[] = [];
      for (const [ini, dir] of dirs) {
        const v = apoyos.get(ini);
        if (v === undefined) continue;
        (dir === 'reduce' ? r : a).push(v);
      }
      if (r.length < MIN_LADO || a.length < MIN_LADO) continue;
      const nMin = Math.min(r.length, a.length);
      const bruto = media(r) - media(a);
      let m = sub.get(partido);
      if (!m) { m = new Map(); sub.set(partido, m); }
      m.set(dim, { valor: bruto * nMin / (nMin + K), peso: nMin });
    }
  }

  const totalPartidos = apoyoPorPartido.size;
  const comunes = dims.filter(dim => {
    let n = 0;
    for (const m of sub.values()) if (m.has(dim)) n++;
    return n >= Math.ceil(totalPartidos * 0.8);
  });
  ultimasComunes.set(eje, comunes);
  ultimasFuera.set(eje, dims.filter(d => !comunes.includes(d)));
  if (!comunes.length) return [];

  const salida: number[] = [];
  for (const m of sub.values()) {
    let num = 0;
    let den = 0;
    for (const dim of comunes) {
      const e = m.get(dim);
      if (!e) continue;
      num += e.valor * e.peso;
      den += e.peso;
    }
    if (den >= 10) salida.push(num / den);
  }
  return salida;
}

const rango = (v: number[]) => (v.length < 2 ? 0 : Math.max(...v) - Math.min(...v));

console.log('\n=== Placebo de los ejes (subejes por dimension) ===\n');

const columnas = ['iniciativa_id', ...DIMS.map(([d]) => d)].join(', ');
const codigos = await paginar<any>((a, b) =>
  db().from('iniciativa_codigo').select(columnas).range(a, b));

const utilSet = new Set<string>(codigos.map(c => c.iniciativa_id as string));
console.log(`Iniciativas codificadas: ${utilSet.size}`);

const apoyos = await paginar<Apoyo>((a, b) =>
  db().from('v_apoyo_iniciativa').select('partido_id, iniciativa_id, apoyo').range(a, b));

const apoyoPorPartido = new Map<string, Map<string, number>>();
for (const a of apoyos) {
  if (a.apoyo === null || !utilSet.has(a.iniciativa_id)) continue;
  let m = apoyoPorPartido.get(a.partido_id);
  if (!m) { m = new Map(); apoyoPorPartido.set(a.partido_id, m); }
  m.set(a.iniciativa_id, Number(a.apoyo));
}
console.log(`Partidos: ${apoyoPorPartido.size}\n`);

const dirPorDim = new Map<string, Map<string, string>>();
for (const [dim] of DIMS) {
  const m = new Map<string, string>();
  for (const c of codigos) {
    if (!utilSet.has(c.iniciativa_id)) continue;
    const v = c[dim];
    if (v === 'aumenta' || v === 'reduce') m.set(c.iniciativa_id, v);
  }
  dirPorDim.set(dim, m);
  console.log(`  ${dim.padEnd(23)} ${m.size} normas con direccion`);
}

const salida: any[] = [];

for (const eje of ['economico', 'social', 'territorial'] as const) {
  const obs = posiciones(eje, dirPorDim, apoyoPorPartido);
  const rangoObservado = rango(obs);
  const bimObservada = bimodalidad(obs);

  console.log(`\n${eje}: ${obs.length} partidos con posicion sobre base comun`);
  const comunes = ultimasComunes.get(eje) ?? [];
  const fuera = ultimasFuera.get(eje) ?? [];
  console.log(`  dimensiones en la base comun: ${comunes.length ? comunes.join(', ') : 'ninguna'}`);
  if (fuera.length) {
    console.log(`  fuera por falta de base:      ${fuera.join(', ')}`);
  }
  console.log(`  rango observado ${rangoObservado.toFixed(4)} · bimodalidad ${bimObservada.toFixed(4)}`);

  if (obs.length < 4) {
    console.log('  menos de 4 partidos medibles, no se calcula placebo');
    continue;
  }

  const rangos: number[] = [];
  const bims: number[] = [];
  for (let r = 0; r < REPS; r++) {
    const revuelto = new Map<string, Map<string, string>>();
    for (const [dim, mapa] of dirPorDim) {
      const claves = [...mapa.keys()];
      const valores = barajar([...mapa.values()]);
      revuelto.set(dim, new Map(claves.map((k, i) => [k, valores[i]])));
    }
    const p = posiciones(eje, revuelto, apoyoPorPartido);
    rangos.push(rango(p));
    bims.push(bimodalidad(p));
    if ((r + 1) % Math.max(50, Math.round(REPS / 20)) === 0) console.log(`  ${r + 1}/${REPS}`);
  }

  const pValor = (rangos.filter(x => x >= rangoObservado).length + 1) / (REPS + 1);
  console.log(`  placebo medio ${media(rangos).toFixed(4)} · p95 ${percentil(rangos, 0.95).toFixed(4)} · max ${Math.max(...rangos).toFixed(4)}`);
  console.log(`  p = ${pValor.toFixed(4)}${pValor > 0.05 ? '  NO SUPERA EL PLACEBO' : ''}`);

  salida.push({
    eje,
    reps: REPS,
    dimensiones: comunes,
    dimensiones_fuera: fuera,
    rango_observado: Number(rangoObservado.toFixed(4)),
    placebo_medio: Number(media(rangos).toFixed(4)),
    placebo_p95: Number(percentil(rangos, 0.95).toFixed(4)),
    placebo_max: Number(Math.max(...rangos).toFixed(4)),
    p_valor: Number(pValor.toFixed(4)),
    bimodalidad_observada: Number(bimObservada.toFixed(4)),
    bimodalidad_placebo_p95: Number(percentil(bims, 0.95).toFixed(4)),
    calculado_at: new Date().toISOString()
  });
}

if (!salida.length) {
  console.log('\nNada que guardar.');
} else {
  const { error } = await db().from('auditoria_placebo').upsert(salida, { onConflict: 'eje' });
  if (error) throw error;
  console.log(`\nGuardados ${salida.length} ejes en auditoria_placebo.`);
}

console.log('\nComprueba:  select * from v_auditoria_eje_votos;\n');