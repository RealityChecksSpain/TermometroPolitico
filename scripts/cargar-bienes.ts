/**
 * Batch: lee PDFs de declaración de bienes (Gemini) y guarda en bienes_declarados.
 * Seguro interrumpir y reanudar. Corrige outliers de escala (€) y subconteo de inmuebles.
 *
 *   npm run bienes:auto
 *   npm run bienes:auto -- --limite=20
 *   npm run bienes:auto -- --solo-outliers
 *   npm run bienes:auto -- --reescribir-altos
 */
import { db, exigirEnv } from '../src/lib/supabase';
import { leerDeclaracion, revalidarCifrasAnomalas } from '../src/lib/leer-declaracion';
import { clasificarVehiculos } from '../src/lib/vehiculos.js';
import { contarInmuebles } from '../src/lib/inmuebles.js';
import {
  sanearDeclaracion,
  sanearImporte,
  patrimonioLiquido,
  motivoAnomalia,
  UMBRAL
} from '../src/lib/euros.js';

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
const REESCRIBIR_ALTOS = args['reescribir-altos'] === 'true';

function casasDe(d: Record<string, any>) {
  return contarInmuebles(d.inmuebles_detalle, d.inmuebles_urbanos, d.inmuebles_rusticos).n_inmuebles;
}

function esAbsurdo(d: Record<string, any>) {
  const m = motivoAnomalia(d);
  if (m) return m;
  const casas = casasDe(d);
  if (casas != null && (casas < 0 || casas > UMBRAL.inmueblesAbsurdo)) {
    return 'número de inmuebles imposible';
  }
  if (d.confianza === 'baja') return 'confianza baja';
  return null;
}

function esAltoSospechoso(h: any) {
  if (!h || h.verificado) return false;
  const pat = h.patrimonio_euros != null ? Number(h.patrimonio_euros) : null;
  const dep = h.depositos != null ? Number(h.depositos) : null;
  if (pat != null && (pat > UMBRAL.patrimonioAlto || pat < UMBRAL.patrimonioBajo)) return true;
  if (dep != null && dep > UMBRAL.depositosSospechosos) return true;
  if (h.introducido_por === 'gemini_outlier') return true;
  return false;
}

async function pendientes() {
  const { data: mandatos, error } = await db()
    .from('mandatos')
    .select('id, url_bienes, politicos(nombre_completo)')
    .not('url_bienes', 'is', null);
  if (error) throw error;

  const lista = (mandatos ?? []).map((m: any) => ({
    id: m.id,
    url_bienes: m.url_bienes,
    nombre_completo: m.politicos?.nombre_completo ?? String(m.id)
  }));

  const { count: nUrls } = await db()
    .from('mandatos')
    .select('id', { count: 'exact', head: true })
    .not('url_bienes', 'is', null);

  const { data: hechos } = await db()
    .from('bienes_declarados')
    .select('mandato_id, patrimonio_euros, n_inmuebles, inmuebles_urbanos, inmuebles_rusticos, inmuebles_detalle, confianza, verificado, depositos, valores, introducido_por');

  const mapa = new Map((hechos ?? []).map(h => [h.mandato_id, h]));
  const conPat = (hechos ?? []).filter(h => h.patrimonio_euros != null).length;
  console.log(`Diagnóstico: ${nUrls ?? 0} mandatos con PDF · ${hechos?.length ?? 0} filas · ${conPat} con patrimonio_euros`);

  if (!(nUrls > 0)) {
    console.log('\nNo hay url_bienes. Antes: npm run fichas\n');
    return [];
  }

  const tieneDato = (h: any) => {
    if (!h) return false;
    if (h.patrimonio_euros != null) return true;
    if (h.depositos != null || h.valores != null) return true;
    if (h.inmuebles_urbanos != null || h.inmuebles_rusticos != null || h.n_inmuebles != null) return true;
    return false;
  };

  return lista.filter(m => {
    const h = mapa.get(m.id);
    if (REESCRIBIR_ALTOS || SOLO_OUTLIERS) {
      if (esAltoSospechoso(h)) return true;
      if (SOLO_OUTLIERS && h?.confianza === 'baja' && !h.verificado) return true;
      return false;
    }
    if (!tieneDato(h)) return true;
    if (esAltoSospechoso(h)) return true;
    if (h.verificado && h.patrimonio_euros != null) return false;
    if (h.confianza === 'alta' && h.patrimonio_euros != null) return false;
    if (h.patrimonio_euros == null && (h.depositos != null || h.valores != null)) return false;
    return h.patrimonio_euros == null;
  }).map(m => ({ ...m, previo: mapa.get(m.id) }));
}

console.log('\n=== Carga automática de bienes (Gemini + PDF) ===\n');

// Backfill: sanear € e inmuebles ya guardados (arregla 187 M sin re-leer PDF)
{
  const { data: filas } = await db()
    .from('bienes_declarados')
    .select('mandato_id, depositos, valores, planes_pensiones, deuda_pendiente, patrimonio_euros, inmuebles_detalle, inmuebles_urbanos, inmuebles_rusticos, n_inmuebles');

  let filled = 0;
  for (const h of filas ?? []) {
    const dep = sanearImporte(h.depositos);
    const val = sanearImporte(h.valores);
    const plan = sanearImporte(h.planes_pensiones);
    const deu = sanearImporte(h.deuda_pendiente);
    const saneado = { depositos: dep, valores: val, planes_pensiones: plan, deuda_pendiente: deu };
    const pat = patrimonioLiquido(saneado);
    const inm = contarInmuebles(h.inmuebles_detalle, h.inmuebles_urbanos, h.inmuebles_rusticos);

    const cambioEuro =
      (h.depositos != null && dep !== null && dep !== Number(h.depositos)) ||
      (h.valores != null && val !== null && val !== Number(h.valores)) ||
      (pat != null && h.patrimonio_euros == null) ||
      (pat != null && h.patrimonio_euros != null && Math.abs(pat - Number(h.patrimonio_euros)) > 0.02);

    const cambioInm =
      inm.n_inmuebles != null &&
      (h.n_inmuebles == null || inm.n_inmuebles > Number(h.n_inmuebles));

    if (!cambioEuro && !cambioInm) continue;

    const patch: Record<string, any> = {};
    if (cambioEuro) {
      if (dep != null) patch.depositos = dep;
      if (val != null) patch.valores = val;
      if (plan != null) patch.planes_pensiones = plan;
      if (deu != null) patch.deuda_pendiente = deu;
      if (pat != null) patch.patrimonio_euros = pat;
    }
    if (cambioInm) patch.n_inmuebles = inm.n_inmuebles;

    if (pat != null && (pat > UMBRAL.patrimonioAlto || pat < UMBRAL.patrimonioBajo)) {
      patch.introducido_por = 'gemini_outlier';
      patch.confianza = 'baja';
    } else if (
      cambioEuro &&
      h.patrimonio_euros != null &&
      Number(h.patrimonio_euros) > UMBRAL.patrimonioAlto &&
      pat != null &&
      pat <= UMBRAL.patrimonioAlto
    ) {
      patch.introducido_por = 'gemini_corrected';
      patch.confianza = 'media';
    }

    const { error } = await db().from('bienes_declarados').update(patch).eq('mandato_id', h.mandato_id);
    if (!error) filled++;
  }
  if (filled) console.log(`Backfill saneo € / inmuebles: ${filled} filas\n`);
}

// Backfill vehículos
{
  const { data: conDetalle } = await db()
    .from('bienes_declarados')
    .select('mandato_id, vehiculos, vehiculos_detalle, n_coches')
    .not('vehiculos_detalle', 'is', null);
  let filled = 0;
  for (const h of conDetalle ?? []) {
    if (h.n_coches != null) continue;
    const veh = clasificarVehiculos(h.vehiculos_detalle, h.vehiculos);
    const { error } = await db().from('bienes_declarados').update({
      n_coches: veh.n_coches,
      n_motos: veh.n_motos,
      n_embarcaciones: veh.n_embarcaciones,
      n_aeronaves: veh.n_aeronaves,
      vehiculos: veh.n_vehiculos || h.vehiculos
    }).eq('mandato_id', h.mandato_id);
    if (!error) filled++;
  }
  if (filled) console.log(`Backfill vehículos: ${filled} filas\n`);
}

const cola = (await pendientes()).slice(0, LIMITE === Infinity ? undefined : LIMITE);
console.log(`Pendientes: ${cola.length}${SOLO_OUTLIERS || REESCRIBIR_ALTOS ? ' (outliers/altos)' : ''}\n`);

if (cola.length === 0) {
  console.log('Nada que procesar.');
  console.log('  Outliers de escala: npm run bienes:auto -- --reescribir-altos');
  console.log('  Prueba: npm run bienes:auto -- --limite=5\n');
  process.exit(0);
}

let ok = 0, fallos = 0, revisita = 0, corregidos = 0;

for (let i = 0; i < cola.length; i++) {
  const m = cola[i];
  process.stdout.write(`[${i + 1}/${cola.length}] ${m.nombre_completo}… `);

  let lectura = await leerDeclaracion(m.url_bienes);
  if (!lectura.ok || !lectura.datos) {
    console.log(`ERROR ${lectura.error}`);
    fallos++;
    continue;
  }

  lectura.datos = sanearDeclaracion(lectura.datos);
  let motivo = esAbsurdo(lectura.datos);
  let corregido = false;

  if (motivo) {
    process.stdout.write(`dudoso (${motivo}) → revalidar… `);
    revisita++;
    const rev = await revalidarCifrasAnomalas(m.url_bienes, lectura.datos, motivo);
    if (rev.ok && rev.datos) {
      lectura.datos = sanearDeclaracion(rev.datos);
      const m2 = esAbsurdo(lectura.datos);
      if (!m2) {
        motivo = null;
        corregido = true;
        corregidos++;
      } else {
        motivo = m2;
      }
    } else {
      const segunda = await leerDeclaracion(m.url_bienes);
      if (segunda.ok && segunda.datos) {
        lectura.datos = sanearDeclaracion(segunda.datos);
        const m2 = esAbsurdo(lectura.datos);
        if (!m2) {
          motivo = null;
          corregido = true;
          corregidos++;
        } else motivo = m2;
      }
    }
  }

  const d = lectura.datos!;
  const veh = clasificarVehiculos(d.vehiculos_detalle, d.vehiculos);
  const inm = contarInmuebles(d.inmuebles_detalle, d.inmuebles_urbanos, d.inmuebles_rusticos);
  const pat = patrimonioLiquido(d);

  const fila = {
    mandato_id: m.id,
    url_declaracion: m.url_bienes,
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
    vehiculos: veh.n_vehiculos || d.vehiculos,
    vehiculos_detalle: d.vehiculos_detalle,
    prestamos_concedido: d.prestamos_concedido,
    deuda_pendiente: d.deuda_pendiente,
    observaciones: d.observaciones,
    patrimonio_euros: pat,
    n_inmuebles: inm.n_inmuebles,
    n_coches: veh.n_coches,
    n_motos: veh.n_motos,
    n_embarcaciones: veh.n_embarcaciones,
    n_aeronaves: veh.n_aeronaves,
    confianza: d.confianza,
    dudas: (d.dudas ?? []).join('; ') || null,
    introducido_por: motivo ? 'gemini_outlier' : (corregido ? 'gemini_corrected' : 'gemini_auto'),
    introducido_at: new Date().toISOString(),
    verificado: false
  };

  const { error } = await db().from('bienes_declarados').upsert(fila, { onConflict: 'mandato_id' });
  if (error) {
    if (/patrimonio_euros|n_inmuebles|n_coches|confianza|dudas/i.test(error.message)) {
      const {
        patrimonio_euros, n_inmuebles, n_coches, n_motos, n_embarcaciones, n_aeronaves,
        confianza, dudas, ...basico
      } = fila;
      const r2 = await db().from('bienes_declarados').upsert({
        ...basico, patrimonio_euros, n_inmuebles, confianza, dudas
      }, { onConflict: 'mandato_id' });
      if (r2.error) {
        const r3 = await db().from('bienes_declarados').upsert(basico, { onConflict: 'mandato_id' });
        if (r3.error) {
          console.log(`ERROR DB ${r3.error.message}`);
          fallos++;
          continue;
        }
      }
      console.log(`ok (parcial) · inm ${inm.n_inmuebles ?? '—'} · ${d.confianza}`);
    } else {
      console.log(`ERROR DB ${error.message}`);
      fallos++;
      continue;
    }
  } else {
    console.log(
      `ok · € ${fila.patrimonio_euros ?? '—'} · inm ${fila.n_inmuebles ?? '—'} · ` +
      `coches ${veh.n_coches} motos ${veh.n_motos} · ${d.confianza}` +
      `${corregido ? ' · corregido' : ''}${motivo ? ' · revisar' : ''}`
    );
  }
  ok++;
}

console.log(`\nListo: ${ok} guardados, ${fallos} fallos, ${revisita} revalidaciones, ${corregidos} corregidos.\n`);
console.log('Para rehacer los >10 M: npm run bienes:auto -- --reescribir-altos\n');
