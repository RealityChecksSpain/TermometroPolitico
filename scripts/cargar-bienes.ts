/**
 * Batch anual: lee PDFs de declaración de bienes (Gemini vision) y guarda en bienes_declarados.
 * Si el dato falta o es absurdo, reintenta. Puede tardar días; es seguro interrumpir y reanudar.
 *
 * Uso:
 *   npm run bienes:auto
 *   npm run bienes:auto -- --limite=20
 *   npm run bienes:auto -- --solo-outliers
 */
import { db, exigirEnv } from '../src/lib/supabase';
import { leerDeclaracion } from '../src/lib/leer-declaracion';

exigirEnv('SUPABASE_URL');
exigirEnv('GEMINI_API_KEY');

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const LIMITE = Number(args.limite ?? 0) || Infinity;
const SOLO_OUTLIERS = args['solo-outliers'] === 'true';

/** Umbrales de sensatez (euros). Fuera → segunda lectura. */
const MIN_PATRIMONIO = -5_000_000;
const MAX_PATRIMONIO = 80_000_000;
const MAX_CASAS = 40;

function sumar(...vals: Array<number | null | undefined>) {
  let t = 0;
  let hay = false;
  for (const v of vals) {
    if (v == null || Number.isNaN(Number(v))) continue;
    t += Number(v);
    hay = true;
  }
  return hay ? t : null;
}

function patrimonioDe(d: Record<string, any>) {
  // Activos líquidos + valores − deuda pendiente. Los inmuebles no traen valoración en el PDF.
  const activos = sumar(d.depositos, d.valores, d.planes_pensiones);
  const deuda = d.deuda_pendiente != null ? Number(d.deuda_pendiente) : 0;
  if (activos == null) return null;
  return Math.round((activos - deuda) * 100) / 100;
}

function casasDe(d: Record<string, any>) {
  const u = d.inmuebles_urbanos != null ? Number(d.inmuebles_urbanos) : 0;
  const r = d.inmuebles_rusticos != null ? Number(d.inmuebles_rusticos) : 0;
  if (d.inmuebles_urbanos == null && d.inmuebles_rusticos == null) return null;
  return u + r;
}

function esAbsurdo(d: Record<string, any>) {
  const pat = patrimonioDe(d);
  const casas = casasDe(d);
  if (pat != null && (pat < MIN_PATRIMONIO || pat > MAX_PATRIMONIO)) return 'patrimonio fuera de rango';
  if (casas != null && (casas < 0 || casas > MAX_CASAS)) return 'número de inmuebles imposible';
  if (d.confianza === 'baja') return 'confianza baja';
  return null;
}

async function pendientes() {
  // Fuente de verdad: mandatos con PDF + filas de bienes aún sin dato útil.
  // No fiarnos de pendientes_bienes.hecho: puede marcar "hecho" sin patrimonio.
  const { data: mandatos, error } = await db()
    .from('mandatos')
    .select('id, nombre_completo, url_bienes')
    .not('url_bienes', 'is', null);
  if (error) throw error;

  const { count: nUrls } = await db()
    .from('mandatos')
    .select('id', { count: 'exact', head: true })
    .not('url_bienes', 'is', null);

  const { data: hechos } = await db()
    .from('bienes_declarados')
    .select('mandato_id, patrimonio_euros, n_inmuebles, inmuebles_urbanos, inmuebles_rusticos, confianza, verificado, depositos, valores');

  const mapa = new Map((hechos ?? []).map(h => [h.mandato_id, h]));
  const conPatrimonio = (hechos ?? []).filter(h => h.patrimonio_euros != null).length;

  console.log(`Diagnóstico: ${nUrls ?? 0} mandatos con URL de PDF · ${hechos?.length ?? 0} filas en bienes_declarados · ${conPatrimonio} con patrimonio_euros`);

  if (!(nUrls > 0)) {
    console.log('\nNo hay url_bienes en mandatos. Antes corre: npm run fichas\n');
    return [];
  }

  const tieneDatoUtil = (h: any) => {
    if (!h) return false;
    if (h.patrimonio_euros != null) return true;
    if (h.depositos != null || h.valores != null) return true;
    if (h.inmuebles_urbanos != null || h.inmuebles_rusticos != null || h.n_inmuebles != null) return true;
    return false;
  };

  return (mandatos ?? []).filter(m => {
    const h = mapa.get(m.id);
    if (!tieneDatoUtil(h)) return true;
    if (SOLO_OUTLIERS) {
      const pat = h.patrimonio_euros;
      const casas = h.n_inmuebles ?? ((h.inmuebles_urbanos ?? 0) + (h.inmuebles_rusticos ?? 0));
      if (pat != null && (pat < MIN_PATRIMONIO || pat > MAX_PATRIMONIO)) return true;
      if (casas > MAX_CASAS) return true;
      if (h.confianza === 'baja' && !h.verificado) return true;
      return false;
    }
    // Reanudar: saltar verificados o confianza alta ya con patrimonio
    if (h.verificado && h.patrimonio_euros != null) return false;
    if (h.confianza === 'alta' && h.patrimonio_euros != null) return false;
    // Si hay fila pero sin patrimonio calculable, reintentar
    if (h.patrimonio_euros == null && (h.depositos != null || h.valores != null)) return false;
    return h.patrimonio_euros == null;
  }).map(m => ({ ...m, previo: mapa.get(m.id) }));
}

console.log('\n=== Carga automática de bienes (Gemini + PDF) ===\n');

// Backfill: filas con depósitos/valores pero sin patrimonio_euros calculado
{
  const { data: sinPat } = await db()
    .from('bienes_declarados')
    .select('mandato_id, depositos, valores, planes_pensiones, deuda_pendiente, inmuebles_urbanos, inmuebles_rusticos, n_inmuebles, patrimonio_euros')
    .is('patrimonio_euros', null);
  let filled = 0;
  for (const h of sinPat ?? []) {
    const pat = patrimonioDe(h);
    const casas = casasDe(h) ?? h.n_inmuebles;
    if (pat == null && casas == null) continue;
    const { error } = await db().from('bienes_declarados').update({
      patrimonio_euros: pat,
      n_inmuebles: casas
    }).eq('mandato_id', h.mandato_id);
    if (!error) filled++;
  }
  if (filled) console.log(`Backfill: ${filled} filas con patrimonio/inmuebles calculados sin re-leer PDF\n`);
}

const cola = (await pendientes()).slice(0, LIMITE === Infinity ? undefined : LIMITE);
console.log(`Pendientes en esta corrida: ${cola.length}${SOLO_OUTLIERS ? ' (solo outliers)' : ''}\n`);
if (cola.length === 0) {
  console.log('Nada que procesar. Si en la app ves «—»:');
  console.log('  1) npm run fichas          ← rellena url_bienes en mandatos');
  console.log('  2) npm run bienes:auto -- --limite=5   ← prueba 5 PDFs');
  console.log('  3) Recarga Diputados → Mayor patrimonio\n');
  process.exit(0);
}

let ok = 0, fallos = 0, revisita = 0;

for (let i = 0; i < cola.length; i++) {
  const m = cola[i];
  const url = m.url_bienes;
  process.stdout.write(`[${i + 1}/${cola.length}] ${m.nombre_completo}… `);

  let lectura = await leerDeclaracion(url);
  if (!lectura.ok || !lectura.datos) {
    console.log(`ERROR ${lectura.error}`);
    fallos++;
    continue;
  }

  let motivo = esAbsurdo(lectura.datos);
  if (motivo) {
    process.stdout.write(`dudoso (${motivo}) → reintento… `);
    revisita++;
    const segunda = await leerDeclaracion(url);
    if (segunda.ok && segunda.datos && !esAbsurdo(segunda.datos)) {
      lectura = segunda;
      motivo = null;
    }
  }

  const d = lectura.datos!;
  const fila = {
    mandato_id: m.id,
    url_declaracion: url,
    fecha_declaracion: d.fecha_declaracion,
    rendimientos_trabajo: d.rendimientos_trabajo,
    rendimientos_capital: d.rendimientos_capital,
    rendimientos_actividades: d.rendimientos_actividades,
    rentas_detalle: d.rentas_detalle,
    irpf_pagado: d.irpf_pagado,
    inmuebles_urbanos: d.inmuebles_urbanos,
    inmuebles_rusticos: d.inmuebles_rusticos,
    inmuebles_detalle: d.inmuebles_detalle,
    depositos: d.depositos,
    valores: d.valores,
    planes_pensiones: d.planes_pensiones,
    vehiculos: d.vehiculos,
    vehiculos_detalle: d.vehiculos_detalle,
    prestamos_concedido: d.prestamos_concedido,
    deuda_pendiente: d.deuda_pendiente,
    observaciones: d.observaciones,
    patrimonio_euros: patrimonioDe(d),
    n_inmuebles: casasDe(d),
    confianza: d.confianza,
    dudas: (d.dudas ?? []).join('; ') || null,
    introducido_por: motivo ? 'gemini_outlier' : 'gemini_auto',
    introducido_at: new Date().toISOString(),
    verificado: false
  };

  const { error } = await db().from('bienes_declarados').upsert(fila, { onConflict: 'mandato_id' });
  if (error) {
    // columnas opcionales (patrimonio_euros / n_inmuebles) pueden no existir aún
    if (/patrimonio_euros|n_inmuebles|confianza|dudas/i.test(error.message)) {
      const { patrimonio_euros, n_inmuebles, confianza, dudas, ...basico } = fila;
      const r2 = await db().from('bienes_declarados').upsert(basico, { onConflict: 'mandato_id' });
      if (r2.error) {
        console.log(`ERROR DB ${r2.error.message}`);
        fallos++;
        continue;
      }
      console.log(`ok (sin columnas extra) · casas ${casasDe(d) ?? '—'} · conf ${d.confianza}`);
    } else {
      console.log(`ERROR DB ${error.message}`);
      fallos++;
      continue;
    }
  } else {
    console.log(`ok · patrimonio ${fila.patrimonio_euros ?? '—'} · casas ${fila.n_inmuebles ?? '—'} · ${d.confianza}${motivo ? ' · revisar' : ''}`);
  }
  ok++;
}

console.log(`\nListo: ${ok} guardados, ${fallos} fallos, ${revisita} reintentos por outlier.\n`);
console.log('Revisa los de confianza baja o gemini_outlier en npm run bienes\n');
