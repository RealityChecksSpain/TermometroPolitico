const TIPO =
  /(?:viviendas?|casas?|chalets?|fincas?(?:\s+(?:urbanas?|rusticas?|rústicas?))?|parcelas?|plazas?(?:\s+de\s+(?:garaje|aparcamiento))?|garajes?|aparcamientos?|locales?(?:\s+comercial(?:es)?)?|naves?(?:\s+industriales?)?|almacenes?|almacen(?:es)?|oficinas?|edificios?|pisos?|apartamentos?|estudios?|trasteros?|solares?|terrenos?|bodegas?|cocheras?)/i;

const MARCA_SOCIEDAD =
  /sociedad|s\.\s?l\.|s\.\s?a\.|s\.l\.u|mercantil|participacion|participación|acciones|cotiza|pacto\s+sucesorio|comunidad\s+de\s+bienes|proindiviso|herencia|hered/i;

function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function porcentajeDe(trozo) {
  const m = String(trozo).match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const v = Number(String(m[1]).replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : null;
}

function esDeSociedad(trozo) {
  const pct = porcentajeDe(trozo);
  if (pct != null && pct < 100) return true;
  return MARCA_SOCIEDAD.test(trozo);
}

export function parsearInmueblesDetalle(detalle) {
  if (!detalle) return [];
  const texto = normalizar(detalle);
  const trozos = texto
    .split(/[;\n|]+|(?=\d+\s+(?:viviend|casa|chalet|finca|parcela|plaza|garaje|aparcamiento|local|nave|almacen|oficina|edificio|piso|apartamento|estudio|trastero|solar|terreno|bodega|cochera))/i)
    .map(t => t.trim())
    .filter(Boolean);

  const out = [];
  for (const trozo of trozos) {
    const pct = porcentajeDe(trozo);
    const sociedad = esDeSociedad(trozo);

    const conNum = trozo.match(new RegExp(`^(\\d{1,3})\\s+(${TIPO.source})\\b`, 'i'));
    if (conNum) {
      const qty = Math.min(80, Number(conNum[1]));
      const tipo = conNum[2];
      out.push({
        qty,
        texto: trozo,
        porcentaje: pct,
        sociedad,
        esVivienda: /viviend|casa|piso|apartamento|chalet|estudio/i.test(tipo)
      });
      continue;
    }

    const menciones = [...trozo.matchAll(new RegExp(`\\b(${TIPO.source})\\b`, 'gi'))];
    if (menciones.length === 0) {
      if (/propiedad|herencia|%|provincia|madrid|barcelona|leon|almeria|coruna|sevilla|valencia/i.test(trozo) && trozo.length > 12) {
        out.push({ qty: 1, texto: trozo, porcentaje: pct, sociedad, esVivienda: false });
      }
      continue;
    }
    for (const m of menciones) {
      out.push({
        qty: 1,
        texto: menciones.length > 1 ? `${m[1]} — ${trozo}` : trozo,
        porcentaje: pct,
        sociedad,
        esVivienda: /viviend|casa|piso|apartamento|chalet|estudio/i.test(m[1])
      });
    }
  }
  return out;
}

export function contarInmuebles(detalle, urbanos = null, rusticos = null, detallePropios = null, detalleSociedad = null) {
  const hayDesglose = Boolean(detallePropios || detalleSociedad);

  const itemsPropios = hayDesglose
    ? parsearInmueblesDetalle(detallePropios).map(i => ({ ...i, sociedad: false }))
    : [];
  const itemsSociedad = hayDesglose
    ? parsearInmueblesDetalle(detalleSociedad).map(i => ({ ...i, sociedad: true }))
    : [];

  const items = hayDesglose
    ? [...itemsPropios, ...itemsSociedad]
    : parsearInmueblesDetalle(detalle);

  let propios = 0;
  let sociedad = 0;
  let viviendas = 0;
  for (const it of items) {
    if (it.sociedad) sociedad += it.qty;
    else propios += it.qty;
    if (it.esVivienda && !it.sociedad) viviendas += it.qty;
  }
  const total = propios + sociedad;

  if (total > 0) {
    return {
      n_inmuebles: total,
      n_inmuebles_propios: propios,
      n_inmuebles_sociedad: sociedad,
      n_viviendas: viviendas,
      fuente: hayDesglose ? 'desglose' : 'detalle',
      items
    };
  }

  const desdeFilas =
    urbanos != null || rusticos != null
      ? Number(urbanos ?? 0) + Number(rusticos ?? 0)
      : null;

  if (desdeFilas != null) {
    return {
      n_inmuebles: desdeFilas,
      n_inmuebles_propios: null,
      n_inmuebles_sociedad: null,
      n_viviendas: null,
      fuente: 'filas',
      items
    };
  }

  return {
    n_inmuebles: null,
    n_inmuebles_propios: null,
    n_inmuebles_sociedad: null,
    n_viviendas: null,
    fuente: null,
    items
  };
}

export function resumirInmuebles(d) {
  if (!d) return null;
  const propios = d.n_inmuebles_propios;
  const sociedad = d.n_inmuebles_sociedad;
  const total = d.n_inmuebles ?? d.n_casas;
  if (total == null) return null;
  if (propios == null && sociedad == null) {
    return { total: Number(total), propios: null, sociedad: null, desglosado: false };
  }
  return {
    total: Number(total),
    propios: Number(propios ?? 0),
    sociedad: Number(sociedad ?? 0),
    desglosado: true
  };
}