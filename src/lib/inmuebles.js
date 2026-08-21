/**
 * Cuenta unidades inmobiliarias del detalle OCR, no solo filas del PDF.
 * "2 VIVIENDAS" → 2 · "13 FINCAS RUSTICAS" → 13 · "PLAZA DE GARAJE" → 1
 */

const TIPO =
  /(?:viviendas?|casas?|fincas?(?:\s+(?:urbanas?|rusticas?|rústicas?))?|plazas?(?:\s+de\s+garaje)?|garajes?|locales?(?:\s+(?:comercial(?:es)?|oficinas?))?|naves?(?:\s+industriales?)?|oficinas?|edificios?|pisos?|apartamentos?|trasteros?|solares?|terrenos?)/i;

function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae pares { qty, texto, esVivienda } de un bloque de detalle. */
export function parsearInmueblesDetalle(detalle) {
  if (!detalle) return [];
  const texto = normalizar(detalle);
  const trozos = texto
    .split(/[;\n|]+|(?=\d+\s+(?:viviend|casa|finca|plaza|garaje|local|nave|oficina|edificio|piso|apartamento|trastero|solar|terreno))/i)
    .map(t => t.trim())
    .filter(Boolean);

  const out = [];
  for (const trozo of trozos) {
    // "2 VIVIENDAS …" o "13 FINCAS RUSTICAS …"
    const conNum = trozo.match(new RegExp(`^(\\d{1,3})\\s+(${TIPO.source})\\b`, 'i'));
    if (conNum) {
      const qty = Math.min(80, Number(conNum[1]));
      const tipo = conNum[2];
      out.push({
        qty,
        texto: trozo,
        esVivienda: /viviend|casa|piso|apartamento/i.test(tipo)
      });
      continue;
    }

    // Sin número inicial: contar menciones "VIVIENDA" / "CASA" sueltas en la misma celda
    const menciones = [...trozo.matchAll(new RegExp(`\\b(${TIPO.source})\\b`, 'gi'))];
    if (menciones.length === 0) {
      // ¿Parece una línea de inmueble genérica?
      if (/propiedad|herencia|%|provincia|madrid|barcelona|leon|almeria/i.test(trozo) && trozo.length > 12) {
        out.push({ qty: 1, texto: trozo, esVivienda: false });
      }
      continue;
    }
    for (const m of menciones) {
      out.push({
        qty: 1,
        texto: m[1],
        esVivienda: /viviend|casa|piso|apartamento/i.test(m[1])
      });
    }
  }
  return out;
}

export function contarInmuebles(detalle, urbanos = null, rusticos = null) {
  const items = parsearInmueblesDetalle(detalle);
  let total = 0;
  let viviendas = 0;
  for (const it of items) {
    total += it.qty;
    if (it.esVivienda) viviendas += it.qty;
  }

  const desdeFilas =
    urbanos != null || rusticos != null
      ? Number(urbanos ?? 0) + Number(rusticos ?? 0)
      : null;

  // Preferir detalle si suma más (el OCR suele subcontar filas agrupadas)
  if (total > 0) {
    return {
      n_inmuebles: total,
      n_viviendas: viviendas,
      fuente: 'detalle',
      items
    };
  }
  if (desdeFilas != null) {
    return {
      n_inmuebles: desdeFilas,
      n_viviendas: null,
      fuente: 'filas',
      items
    };
  }
  return { n_inmuebles: null, n_viviendas: null, fuente: null, items };
}
