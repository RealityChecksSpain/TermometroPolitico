/**
 * Cuenta unidades inmobiliarias del detalle OCR.
 *
 * "2 TRASTEROS" → 2
 * "Vivienda, plaza de garaje y Trastero" → 3
 * "1 VIVIENDA 1 GARAJE 1 TRASTERO" → 3
 * No infla por m², % ni basura OCR repetida.
 */

const TIPO =
  /(?:viviendas?|casas?|fincas?(?:\s+(?:urbanas?|rusticas?))?|plazas?(?:\s+de\s+garaje)?|garajes?|local(?:es)?(?:\s+comercial(?:es)?)?|naves?(?:\s+industriales?)?|oficinas?|edificios?|pisos?|apartamentos?|trasteros?|solares?|terrenos?)/i;

function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function esViviendaTipo(tipo) {
  return /viviend|casa|piso|apartamento/i.test(tipo);
}

/** Suma todos los (N?) TIPO dentro de una entrada. */
function contarEntrada(raw) {
  const trozo = normalizar(raw);
  if (!trozo || trozo.length < 3) return null;

  const re = new RegExp(`(?:(\\d{1,3})\\s+)?(${TIPO.source})\\b`, 'gi');
  const menciones = [...trozo.matchAll(re)];
  if (menciones.length === 0) return null;

  // Basura OCR: muchas palabras de tipo sin ningún dígito → 1 unidad
  const hayDigito = /\d/.test(trozo);
  if (!hayDigito && menciones.length > 8) {
    return { qty: 1, texto: trozo, esVivienda: esViviendaTipo(menciones[0][2]), n_viviendas: 0 };
  }

  let qty = 0;
  let viviendas = 0;
  for (const m of menciones) {
    const n = m[1] != null ? Math.min(40, Number(m[1])) : 1;
    if (!Number.isFinite(n) || n < 1) continue;
    qty += n;
    if (esViviendaTipo(m[2])) viviendas += n;
  }
  if (qty < 1) return null;
  return {
    qty: Math.min(80, qty),
    texto: trozo,
    esVivienda: viviendas > 0,
    n_viviendas: viviendas
  };
}

export function parsearInmueblesDetalle(detalle) {
  if (!detalle) return [];
  const texto = normalizar(detalle);

  let trozos = texto
    .split(/[;\n|]+/)
    .map(t => t.trim())
    .filter(Boolean);

  // Un solo bloque con varias "N TIPO" → trocear
  if (trozos.length === 1) {
    const partes = texto
      .split(/(?=\d{1,3}\s+(?:viviend|casa|finca|plaza|garaje|local|nave|oficina|edificio|piso|apartamento|trastero|solar|terreno)\b)/i)
      .map(t => t.trim())
      .filter(Boolean);
    if (partes.length > 1) trozos = partes;
  }

  const out = [];
  for (const trozo of trozos) {
    const item = contarEntrada(trozo);
    if (item) out.push(item);
  }
  return out;
}

export function contarInmuebles(detalle, urbanos = null, rusticos = null) {
  const items = parsearInmueblesDetalle(detalle);
  let total = 0;
  let viviendas = 0;
  for (const it of items) {
    total += it.qty;
    viviendas += it.n_viviendas ?? (it.esVivienda ? it.qty : 0);
  }

  const desdeFilas =
    urbanos != null || rusticos != null
      ? Number(urbanos ?? 0) + Number(rusticos ?? 0)
      : null;

  if (total > 0) {
    return { n_inmuebles: total, n_viviendas: viviendas, fuente: 'detalle', items };
  }
  if (desdeFilas != null) {
    return { n_inmuebles: desdeFilas, n_viviendas: null, fuente: 'filas', items };
  }
  return { n_inmuebles: null, n_viviendas: null, fuente: null, items };
}
