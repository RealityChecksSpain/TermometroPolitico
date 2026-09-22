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

const args: Record<string, string> = {};
{
  const crudos = process.argv.slice(2);
  for (let i = 0; i < crudos.length; i++) {
    const a = crudos[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.replace(/^--/, '').split('=');
    if (v !== undefined) { args[k] = v; continue; }
    const siguiente = crudos[i + 1];
    if (siguiente && !siguiente.startsWith('--')) { args[k] = siguiente; i++; }
    else args[k] = 'true';
  }
}

const LIMITE = (() => {
  const bruto = args.limite;
  if (bruto === undefined) return Infinity;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n <= 0) {
    console.log(`\n--limite="${bruto}" no es un numero positivo.`);
    console.log('Usa --limite=5 o --limite 5. Abortado para no gastar llamadas de mas.\n');
    process.exit(1);
  }
  return n;
})();
const SOLO_OUTLIERS = args['solo-outliers'] === 'true';
const REESCRIBIR_ALTOS = args['reescribir-altos'] === 'true';
const REHACER_CADENAS = args['rehacer-cadenas'] === 'true';
const DESDE = Math.max(0, Number(args.desde ?? 0) || 0);
const CADENA = args.cadena === 'true' || REHACER_CADENAS;

const ORDEN_CONFIANZA: Record<string, number> = { alta: 3, media: 2, baja: 1 };

const CAMPOS_DINERO = ['depositos', 'valores', 'planes_pensiones', 'deuda_pendiente', 'prestamos_concedido'];

const INTENTOS = 3;
const ESPERA_BASE = 4000;

function dormir(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function leerConReintento(url: string) {
  let ultimo = '';
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const r = await leerDeclaracion(url);
      if (r.ok && r.datos) return r;
      ultimo = String(r.error ?? 'sin datos');
    } catch (e: any) {
      ultimo = String(e?.cause?.code ?? e?.message ?? e);
    }
    if (intento < INTENTOS) {
      process.stdout.write(`reintento ${intento}/${INTENTOS - 1} (${ultimo})… `);
      await dormir(ESPERA_BASE * intento);
    }
  }
  return { ok: false as const, datos: null, error: ultimo };
}

function peorConfianza(a: any, b: any) {
  const na = ORDEN_CONFIANZA[String(a)] ?? 0;
  const nb = ORDEN_CONFIANZA[String(b)] ?? 0;
  if (!na) return b;
  if (!nb) return a;
  return na <= nb ? a : b;
}

function vacio(v: any) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function componer<T extends Record<string, any>>(previo: T | null, nuevo: T): T {
  if (!previo) return { ...nuevo };
  const salida: any = { ...previo };
  for (const clave of Object.keys(nuevo)) {
    if (!vacio(nuevo[clave])) salida[clave] = nuevo[clave];
  }
  salida.confianza = peorConfianza(previo.confianza, nuevo.confianza);
  const notas = [previo.observaciones, nuevo.observaciones]
    .filter(t => !vacio(t))
    .map(t => String(t).trim());
  salida.observaciones = notas.length ? Array.from(new Set(notas)).join(' | ') : null;
  return salida as T;
}

function casasDe(d: Record<string, any>) {
  return contarInmuebles(
    d.inmuebles_detalle,
    d.inmuebles_urbanos,
    d.inmuebles_rusticos,
    d.inmuebles_detalle_propios,
    d.inmuebles_detalle_sociedad
  ).n_inmuebles;
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
    .select('mandato_id, patrimonio_euros, n_inmuebles, n_inmuebles_propios, n_inmuebles_sociedad, n_inmuebles_equivalentes, n_viviendas, n_suelo, n_anejos, n_productivos, n_otros_bienes, inmuebles_urbanos, inmuebles_rusticos, inmuebles_detalle, inmuebles_detalle_propios, inmuebles_detalle_sociedad, confianza, verificado, depositos, valores, introducido_por');

  const mapa = new Map<any, any>((hechos ?? []).map((h: any) => [h.mandato_id, h]));
  const conPat = (hechos ?? []).filter(h => h.patrimonio_euros != null).length;
  const totalUrls = Number(nUrls ?? 0);
  console.log(`Diagnóstico: ${totalUrls} mandatos con PDF · ${hechos?.length ?? 0} filas · ${conPat} con patrimonio_euros`);

  if (!(totalUrls > 0)) {
    console.log('\nNo hay url_bienes. Antes: npm run fichas\n');
    return [];
  }

  const tieneDato = (h: any) => {
    if (!h) return false;
    if (h.patrimonio_euros != null) return true;
    if (h.depositos != null || h.valores != null) return true;
    if (h.inmuebles_urbanos != null || h.inmuebles_rusticos != null || h.n_inmuebles != null) return true;
    if (h.inmuebles_detalle_propios != null || h.inmuebles_detalle_sociedad != null) return true;
    return false;
  };

  const seleccion = lista.filter(m => {
    const h: any = mapa.get(m.id);
    if (REESCRIBIR_ALTOS || SOLO_OUTLIERS) {
      if (esAltoSospechoso(h)) return true;
      if (SOLO_OUTLIERS && h?.confianza === 'baja' && !h.verificado) return true;
      return false;
    }
    if (!tieneDato(h)) return true;
    if (esAltoSospechoso(h)) return true;
    if (h.n_inmuebles != null && h.n_inmuebles_propios == null) return true;
    if (h.n_inmuebles != null && h.n_inmuebles_equivalentes == null) return true;
    if (h.n_inmuebles != null && h.n_viviendas == null) return true;
    if (h.verificado && h.patrimonio_euros != null) return false;
    if (h.confianza === 'alta' && h.patrimonio_euros != null) return false;
    if (h.patrimonio_euros == null && (h.depositos != null || h.valores != null)) return false;
    return h.patrimonio_euros == null;
  }).map(m => ({ ...m, previo: mapa.get(m.id) }));

  if (!CADENA) return seleccion;

  const { data: docs, error: eDocs } = await db()
    .from('declaraciones_bienes')
    .select('mandato_id, documento_url, fecha_declaracion')
    .order('fecha_declaracion', { ascending: true });

  if (eDocs) {
    console.log(`  aviso: no se pudo leer declaraciones_bienes (${eDocs.message}). Sigo con una sola por mandato.`);
    return seleccion;
  }

  const cadenas = new Map<string, string[]>();
  for (const d of docs ?? []) {
    if (!d.documento_url) continue;
    const previas = cadenas.get(d.mandato_id) ?? [];
    if (!previas.includes(d.documento_url)) previas.push(d.documento_url);
    cadenas.set(d.mandato_id, previas);
  }

  const base = REHACER_CADENAS
    ? lista.filter(m => (cadenas.get(m.id) ?? []).length > 1).map(m => ({ ...m, previo: mapa.get(m.id) }))
    : seleccion;

  if (REHACER_CADENAS) {
    console.log(`Rehacer cadenas: ${base.length} mandatos con más de una declaración, se reprocesan todos.`);
  }

  let conCadena = 0, pdfs = 0;
  const conDocumentos = base.map(m => {
    const urls = cadenas.get(m.id) ?? [];
    const finales = urls.length ? urls : [m.url_bienes];
    if (finales.length > 1) conCadena++;
    pdfs += finales.length;
    return { ...m, documentos: finales };
  });

  console.log(`Cadena: ${conCadena} mandatos con más de una declaración · ${pdfs} PDF a leer`);
  return conDocumentos;
}

console.log('\n=== Carga automática de bienes (Gemini + PDF) ===\n');

{
  const { data: filas } = await db()
    .from('bienes_declarados')
    .select('mandato_id, depositos, valores, planes_pensiones, deuda_pendiente, patrimonio_euros, inmuebles_detalle, inmuebles_detalle_propios, inmuebles_detalle_sociedad, inmuebles_urbanos, inmuebles_rusticos, n_inmuebles, n_inmuebles_propios, n_inmuebles_sociedad, n_inmuebles_equivalentes, n_viviendas, n_suelo, n_anejos, n_productivos, n_otros_bienes');

  let filled = 0;
  for (const h of filas ?? []) {
    const dep = sanearImporte(h.depositos);
    const val = sanearImporte(h.valores);
    const plan = sanearImporte(h.planes_pensiones);
    const deu = sanearImporte(h.deuda_pendiente);
    const saneado = { depositos: dep, valores: val, planes_pensiones: plan, deuda_pendiente: deu };
    const pat = patrimonioLiquido(saneado);
    const inm = contarInmuebles(
      h.inmuebles_detalle,
      h.inmuebles_urbanos,
      h.inmuebles_rusticos,
      h.inmuebles_detalle_propios,
      h.inmuebles_detalle_sociedad
    );

    const cambioEuro =
      (h.depositos != null && dep !== null && dep !== Number(h.depositos)) ||
      (h.valores != null && val !== null && val !== Number(h.valores)) ||
      (pat != null && h.patrimonio_euros == null) ||
      (pat != null && h.patrimonio_euros != null && Math.abs(pat - Number(h.patrimonio_euros)) > 0.02);

    const cambioInm =
      inm.n_inmuebles != null &&
      (h.n_inmuebles == null ||
        inm.n_inmuebles !== Number(h.n_inmuebles) ||
        (inm.n_inmuebles_propios != null && h.n_inmuebles_propios == null));

    if (!cambioEuro && !cambioInm) continue;

    const patch: Record<string, any> = {};
    if (cambioEuro) {
      if (dep != null) patch.depositos = dep;
      if (val != null) patch.valores = val;
      if (plan != null) patch.planes_pensiones = plan;
      if (deu != null) patch.deuda_pendiente = deu;
      if (pat != null) patch.patrimonio_euros = pat;
    }
    if (cambioInm) {
      patch.n_inmuebles = inm.n_inmuebles;
      if (inm.fuente === 'desglose') {
        patch.n_inmuebles_propios = inm.n_inmuebles_propios;
        patch.n_inmuebles_sociedad = inm.n_inmuebles_sociedad;
        patch.n_inmuebles_equivalentes = inm.n_inmuebles_equivalentes;
        patch.n_viviendas = inm.n_viviendas;
        patch.n_suelo = inm.n_suelo;
        patch.n_anejos = inm.n_anejos;
        patch.n_productivos = inm.n_productivos;
        patch.n_otros_bienes = inm.n_otros_bienes;
      }
    }

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

const todos = await pendientes();
if (DESDE >= todos.length && todos.length > 0) {
  console.log(`\n--desde=${DESDE} deja la cola vacía: solo hay ${todos.length}.\n`);
  process.exit(1);
}
const cola = todos.slice(DESDE).slice(0, LIMITE === Infinity ? undefined : LIMITE);
if (DESDE) console.log(`Saltando los primeros ${DESDE}; quedan ${cola.length}.`);
console.log(`Pendientes: ${cola.length}${SOLO_OUTLIERS || REESCRIBIR_ALTOS ? ' (outliers/altos)' : ''}\n`);

if (cola.length === 0) {
  console.log('Nada que procesar.');
  console.log('  Outliers de escala: npm run bienes:auto -- --reescribir-altos');
  console.log('  Prueba: npm run bienes:auto -- --limite=5\n');
  process.exit(0);
}

let ok = 0, fallos = 0, revisita = 0, corregidos = 0, conArrastre = 0;

for (let i = 0; i < cola.length; i++) {
  const m = cola[i];
  process.stdout.write(`[${i + 1}/${cola.length}] ${m.nombre_completo}… `);

  const cadena: string[] = CADENA && Array.isArray((m as any).documentos) && (m as any).documentos.length
    ? (m as any).documentos
    : [m.url_bienes];

  let compuesto: any = null;
  let leidos = 0;
  let ultimoError = '';
  const origen: Record<string, number> = {};
  let ultimoLeido = -1;
  let ultimoDatos: any = null;

  for (let k = 0; k < cadena.length; k++) {
    const lectura = await leerConReintento(cadena[k]);
    if (!lectura.ok || !lectura.datos) { ultimoError = String(lectura.error ?? 'sin datos'); continue; }
    const saneado: any = sanearDeclaracion(lectura.datos);
    for (const clave of Object.keys(saneado)) {
      if (!vacio(saneado[clave])) origen[clave] = k;
    }
    compuesto = componer(compuesto, saneado);
    leidos++;
    ultimoLeido = k;
    ultimoDatos = saneado;
  }

  const heredables = CAMPOS_DINERO.filter(c => origen[c] !== undefined && origen[c] < ultimoLeido);
  if (heredables.length && compuesto && ultimoDatos) {
    for (const c of CAMPOS_DINERO) {
      compuesto[c] = vacio(ultimoDatos[c]) ? null : ultimoDatos[c];
    }
    conArrastre++;
  }

  if (!compuesto) {
    console.log(`ERROR ${ultimoError}`);
    fallos++;
    continue;
  }

  if (cadena.length > 1) {
    process.stdout.write(`${leidos}/${cadena.length} declaraciones… `);
    if (heredables.length) process.stdout.write(`dinero solo de la última (se descartan ${heredables.join(', ')} de años previos)… `);
  }

  const ultimoDoc = cadena[cadena.length - 1];
  let datos = compuesto;
  let motivo = esAbsurdo(datos);
  let corregido = false;

  if (motivo) {
    process.stdout.write(`dudoso (${motivo}) → revalidar… `);
    revisita++;
    const rev = await revalidarCifrasAnomalas(ultimoDoc, datos, motivo);
    if (rev.ok && rev.datos) {
      datos = sanearDeclaracion(rev.datos);
      const m2 = esAbsurdo(datos);
      if (!m2) {
        motivo = null;
        corregido = true;
        corregidos++;
      } else {
        motivo = m2;
      }
    } else {
      const segunda = await leerDeclaracion(ultimoDoc);
      if (segunda.ok && segunda.datos) {
        datos = sanearDeclaracion(segunda.datos);
        const m2 = esAbsurdo(datos);
        if (!m2) {
          motivo = null;
          corregido = true;
          corregidos++;
        } else motivo = m2;
      }
    }
  }

  const d = datos;
  const veh = clasificarVehiculos(d.vehiculos_detalle, d.vehiculos);
  const inm = contarInmuebles(
    d.inmuebles_detalle,
    d.inmuebles_urbanos,
    d.inmuebles_rusticos,
    d.inmuebles_detalle_propios,
    d.inmuebles_detalle_sociedad
  );
  const pat = patrimonioLiquido(d);

  const fila = {
    mandato_id: m.id,
    url_declaracion: ultimoDoc,
    fecha_declaracion: d.fecha_declaracion,
    rendimientos_trabajo: d.rendimientos_trabajo,
    rendimientos_capital: d.rendimientos_capital,
    rendimientos_actividades: d.rendimientos_actividades,
    rentas_detalle: d.rentas_detalle,
    irpf_pagado: d.irpf_pagado,
    inmuebles_urbanos: d.inmuebles_urbanos,
    inmuebles_rusticos: d.inmuebles_rusticos,
    inmuebles_detalle: d.inmuebles_detalle,
    inmuebles_detalle_propios: d.inmuebles_detalle_propios,
    inmuebles_detalle_sociedad: d.inmuebles_detalle_sociedad,
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
    n_inmuebles_propios: inm.n_inmuebles_propios,
    n_inmuebles_sociedad: inm.n_inmuebles_sociedad,
    n_inmuebles_equivalentes: inm.n_inmuebles_equivalentes,
    n_viviendas: inm.n_viviendas,
    n_suelo: inm.n_suelo,
    n_anejos: inm.n_anejos,
    n_productivos: inm.n_productivos,
    n_otros_bienes: inm.n_otros_bienes,
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
    if (/patrimonio_euros|n_inmuebles|n_coches|confianza|dudas|inmuebles_detalle_/i.test(error.message)) {
      const {
        patrimonio_euros, n_inmuebles, n_inmuebles_propios, n_inmuebles_sociedad, n_inmuebles_equivalentes,
        inmuebles_detalle_propios, inmuebles_detalle_sociedad,
        n_coches, n_motos, n_embarcaciones, n_aeronaves,
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
      `ok · € ${fila.patrimonio_euros ?? '—'} · inm ${fila.n_inmuebles ?? '—'}` +
      `${inm.n_inmuebles_propios != null ? ` (${inm.n_inmuebles_propios} propios + ${inm.n_inmuebles_sociedad} soc. · eq ${inm.n_inmuebles_equivalentes})` : ''} · ` +
      `coches ${veh.n_coches} motos ${veh.n_motos} · ${d.confianza}` +
      `${corregido ? ' · corregido' : ''}${motivo ? ' · revisar' : ''}`
    );
  }
  ok++;
}

console.log(`\nListo: ${ok} guardados, ${fallos} fallos, ${revisita} revalidaciones, ${corregidos} corregidos.`);
if (CADENA) {
  console.log(`${conArrastre} tenían cifras de dinero solo en declaraciones antiguas. No se heredan: el patrimonio sale únicamente de la declaración más reciente, aunque quede vacío.`);
  console.log('Los recuentos de inmuebles y vehículos sí se heredan: no se restan entre sí, así que mezclar años no inventa una cifra.');
}
console.log('');
console.log('Para rehacer los >10 M: npm run bienes:auto -- --reescribir-altos\n');
console.log('Antes de la primera pasada con desglose: sql/2026-08-inmuebles-desglose.sql\n');