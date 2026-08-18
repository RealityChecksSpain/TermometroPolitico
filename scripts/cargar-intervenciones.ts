import { db, exigirEnv } from '../src/lib/supabase';
import { normalizarNombre } from '../src/lib/texto';
import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');

export function limpiarOrador(bruto: string): string {
  const s = String(bruto).trim();
  let profundidad = 0;
  let corte = s.length;

  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (c === ')') profundidad++;
    else if (c === '(') {
      profundidad--;
      if (profundidad === 0) corte = i;
      if (profundidad < 0) break;
    } else if (profundidad === 0 && c !== ' ') {
      break;
    }
  }

  return s.slice(0, corte).replace(/[\s(),]+$/, '').trim();
}

function aIso(fecha: string | null): string | null {
  if (!fecha) return null;
  const m = String(fecha).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function aSegundos(ini: string | null, fin: string | null): number | null {
  if (!ini || !fin) return null;
  const p = (s: string) => {
    const [h, m] = String(s).split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 3600 + m * 60 : null;
  };
  const a = p(ini);
  const b = p(fin);
  if (a === null || b === null) return null;
  const d = b - a;
  return d >= 0 ? d : d + 86400;
}

function limpiarMultilinea(v: any): string | null {
  if (!v) return null;
  const partes = String(v).split(/\n+/).map(s => s.trim()).filter(Boolean);
  const unicas = Array.from(new Set(partes));
  return unicas.join(' · ') || null;
}

function extraerFilas(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const k of Object.keys(json)) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && typeof json[k] === 'object') {
      for (const k2 of Object.keys(json[k])) if (Array.isArray(json[k][k2])) return json[k][k2];
    }
  }
  throw new Error('sin array reconocible');
}

console.log('\nLocalizando fichero...');
const html = await descargarHtml(`${BASE_CONGRESO}/es/opendata/intervenciones`);
const url = masReciente(
  extraerUrls(html, /webpublica\/opendata\/intervenciones\/[^"'\s<>]+\.json/).filter(u =>
    /Cronologicamente/i.test(u)
  )
);
if (!url) throw new Error('No se encontro IntervencionesCronologicamente');
console.log('  ' + url);

const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
const filas = extraerFilas(await res.json());
console.log(`  ${filas.length} intervenciones`);

console.log('\nCargando indice de diputados...');
const indice = new Map<string, string>();
let desde = 0;
for (;;) {
  const { data, error } = await db()
    .from('mandatos')
    .select('id, politicos!inner(nombre, apellidos)')
    .eq('legislatura_id', legislaturaId)
    .range(desde, desde + 999);
  if (error) throw error;
  if (!data?.length) break;
  data.forEach((m: any) => {
    const clave = normalizarNombre(`${m.politicos.apellidos}, ${m.politicos.nombre}`);
    if (!indice.has(clave)) indice.set(clave, m.id);
  });
  if (data.length < 1000) break;
  desde += 1000;
}

const { data: alias } = await db().from('alias_diputados').select('alias_normalizado, politico_id');
const { data: mandatosPorPolitico } = await db()
  .from('mandatos')
  .select('id, politico_id')
  .eq('legislatura_id', legislaturaId);

const mapaPolitico = new Map((mandatosPorPolitico ?? []).map((m: any) => [m.politico_id, m.id]));
(alias ?? []).forEach((a: any) => {
  const mandatoId = mapaPolitico.get(a.politico_id);
  if (mandatoId && !indice.has(a.alias_normalizado)) indice.set(a.alias_normalizado, mandatoId);
});

console.log(`  ${indice.size} claves de busqueda`);

const lote: any[] = [];
const sinResolver = new Map<string, number>();
let noDiputados = 0;

filas.forEach((f: any, i: number) => {
  const fecha = aIso(f.SESION);
  if (!fecha) return;

  const oradorLimpio = limpiarOrador(f.ORADOR ?? '');
  if (!oradorLimpio) return;

  const esDiputado = /diputad/i.test(f.CARGOORADOR ?? '');
  const mandatoId = indice.get(normalizarNombre(oradorLimpio)) ?? null;

  if (!mandatoId) {
    if (esDiputado) sinResolver.set(oradorLimpio, (sinResolver.get(oradorLimpio) ?? 0) + 1);
    else noDiputados++;
  }

  lote.push({
    legislatura_id: legislaturaId,
    mandato_id: mandatoId,
    fecha,
    organo: f.ORGANO ?? null,
    fase: limpiarMultilinea(f.FASE),
    tipo_intervencion: f.TIPOINTERVENCION ?? null,
    objeto: limpiarMultilinea(f.OBJETOINICIATIVA),
    orador_origen: oradorLimpio,
    cargo_orador: limpiarMultilinea(f.CARGOORADOR),
    hora_inicio: f.INICIOINTERVENCION || null,
    hora_fin: f.FININTERVENCION || null,
    duracion_segundos: aSegundos(f.INICIOINTERVENCION, f.FININTERVENCION),
    video_url: f.ENLACEDESCARGADIRECTA ?? null,
    enlace_pdf: f.ENLACEPDF ?? null,
    enlace_texto: f.ENLACETEXTOINTEGRO ?? null,
    fuente_url: url,
    clave_unica: `${fecha}|${f.ORGANO}|${f.INICIOINTERVENCION}|${normalizarNombre(oradorLimpio)}|${i}`
  });
});

console.log(`\n  ${lote.length} filas preparadas`);
console.log(`  ${lote.filter(l => l.mandato_id).length} con diputado resuelto`);
console.log(`  ${noDiputados} de no diputados (ministros, presidencia, invitados)`);
console.log(`  ${sinResolver.size} nombres de diputado sin resolver`);
if (sinResolver.size > 0) {
  Array.from(sinResolver.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([n, c]) => console.log(`    ${String(c).padStart(4)}  ${n}`));
}

console.log('\nInsertando...');
let insertadas = 0;
for (let i = 0; i < lote.length; i += 500) {
  const trozo = lote.slice(i, i + 500);
  const { error } = await db()
    .from('intervenciones')
    .upsert(trozo, { onConflict: 'clave_unica' });
  if (error) {
    console.error(`  error en ${i}: ${error.message}`);
    break;
  }
  insertadas += trozo.length;
  if (i % 5000 === 0) console.log(`  ${insertadas}/${lote.length}`);
}

console.log(`\nLISTO. ${insertadas} intervenciones.`);
console.log('  select * from v_tiempo_por_grupo order by minutos_por_diputado desc;');
console.log('  select * from v_tiempo_palabra order by minutos desc limit 20;\n');

export {};
