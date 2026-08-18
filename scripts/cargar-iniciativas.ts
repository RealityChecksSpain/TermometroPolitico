import { db, exigirEnv } from '../src/lib/supabase';
import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');

const TIPOS: Record<string, string> = {
  'proyecto de ley': 'proyecto_ley',
  'proposición de ley': 'proposicion_ley',
  'proposicion de ley': 'proposicion_ley',
  'propuesta de reforma': 'otro',
  'reforma': 'otro'
};

const ORIGENES: Record<string, string> = {
  gobierno: 'gobierno',
  'grupo parlamentario': 'grupo_parlamentario',
  senado: 'otro',
  'comunidades y ciudades': 'asamblea_autonomica',
  diputados: 'diputado',
  popular: 'iniciativa_popular'
};

function limpiar(v: any): string | null {
  if (v === null || v === undefined) return null;
  const partes = String(v).split(/\n+/).map(s => s.trim()).filter(Boolean);
  const unicas = Array.from(new Set(partes));
  const r = unicas.join(' · ').trim();
  return r || null;
}

function aIso(v: any): string | null {
  const m = String(v ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function clasificarTipo(tipo: string | null): string {
  const t = (tipo ?? '').toLowerCase();
  for (const [k, v] of Object.entries(TIPOS)) if (t.includes(k)) return v;
  return 'otro';
}

function clasificarOrigen(tipo: string | null, autor: string | null): string {
  const t = `${tipo ?? ''} ${autor ?? ''}`.toLowerCase();
  for (const [k, v] of Object.entries(ORIGENES)) if (t.includes(k)) return v;
  return 'otro';
}

function estado(situacion: string | null): string {
  const s = (situacion ?? '').toLowerCase();
  if (s.includes('cerrado')) return 'caducada';
  if (s.includes('aprobad')) return 'aprobada';
  if (s.includes('rechazad')) return 'rechazada';
  if (s.includes('retirad')) return 'retirada';
  if (s.includes('enmienda') || s.includes('comisión') || s.includes('pleno')) return 'en_tramite';
  return 'presentada';
}

function extraerFilas(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const k of Object.keys(json)) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && typeof json[k] === 'object') {
      for (const k2 of Object.keys(json[k])) if (Array.isArray(json[k][k2])) return json[k][k2];
    }
  }
  return [];
}

console.log('\nLocalizando ficheros...');
const html = await descargarHtml(`${BASE_CONGRESO}/es/opendata/iniciativas`);
const todos = extraerUrls(html, /webpublica\/opendata\/iniciativas\/[^"'\s<>]+\.json/);

const familias = ['IniciativasLegislativasAprobadas', 'ProyectosDeLey', 'PropuestasDeReforma', 'ProposicionesDeLey'];
const elegidos = familias
  .map(f => masReciente(todos.filter(u => u.includes(f))))
  .filter(Boolean) as string[];

elegidos.forEach(u => console.log('  ' + u.split('/').pop()));

const vistos = new Set<string>();
const lote: any[] = [];

for (const url of elegidos) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) { console.log(`  HTTP ${res.status} en ${url}`); continue; }
  const filas = extraerFilas(await res.json());
  console.log(`  ${filas.length} en ${url.split('/').pop()?.split('__')[0]}`);

  filas.forEach((f: any) => {
    const expediente = limpiar(f.NUMEXPEDIENTE);
    const titulo = limpiar(f.OBJETO);
    if (!expediente || !titulo) return;
    if (vistos.has(expediente)) return;
    vistos.add(expediente);

    const tipoTexto = limpiar(f.TIPO);
    const autor = limpiar(f.AUTOR);
    const situacion = limpiar(f.SITUACIONACTUAL);

    lote.push({
      legislatura_id: legislaturaId,
      expediente,
      tipo: clasificarTipo(tipoTexto),
      titulo,
      estado: estado(situacion),
      origen: clasificarOrigen(tipoTexto, autor),
      fecha_presentacion: aIso(f.FECHAPRESENTACION) ?? '2023-08-17',
      fecha_calificacion: aIso(f.FECHACALIFICACION),
      autor_texto: autor,
      tipo_texto: tipoTexto,
      supertipo: limpiar(f.SUPERTIPO),
      situacion,
      tramitacion: limpiar(f.TRAMITACIONSEGUIDA),
      plazos: limpiar(f.PLAZOS),
      enlaces_bocg: limpiar(f.ENLACESBOCG),
      boletin_url: limpiar(f.ENLACESBOCG)?.split(' ')[0] ?? null,
      fuente_url: url
    });
  });
}

console.log(`\n${lote.length} iniciativas unicas`);

let ok = 0;
for (let i = 0; i < lote.length; i += 300) {
  const { error } = await db()
    .from('iniciativas')
    .upsert(lote.slice(i, i + 300), { onConflict: 'legislatura_id,expediente' });
  if (error) { console.error('  ' + error.message); break; }
  ok += Math.min(300, lote.length - i);
}
console.log(`${ok} guardadas`);

console.log('\nSIGUIENTE: npm run enlazar\n');

export {};