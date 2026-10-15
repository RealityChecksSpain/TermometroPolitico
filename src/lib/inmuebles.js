const TIPO =
  /(?:vivienda(?:s)?|casa(?:s)?|chalet(?:s|es)?|finca(?:s)?(?:\s+(?:urbana(?:s)?|rustica(?:s)?))?|parcela(?:s)?|(?:plaza|pza)(?:s)?\.?(?:\s+(?:de\s+)?(?:gara(?:j|g)e(?:s)?|aparcamiento(?:s)?))?|gara(?:j|g)e(?:s)?|aparcamiento(?:s)?|local(?:es)?(?:\s+comercial(?:es)?)?|nave(?:s)?(?:\s+industrial(?:es)?)?|almacen(?:es)?|oficina(?:s)?|edificio(?:s)?|piso(?:s)?|apartamento(?:s)?|estudio(?:s)?|trastero(?:s)?|solar(?:es)?|suelo(?:s)?|terreno(?:s)?|bodega(?:s)?|cochera(?:s)?)/i;

const MARCA_SOCIEDAD =
  /\b(?:s\.?\s?l\.?\s?u|s\.?\s?l|s\.?\s?a)\b\.?|sociedad(?!\s+(?:de\s+)?gananciales)|mercantil|participaciones?\s+sociales|acciones|cotiza/i;

const SIN_PORCENTAJE = /\bsin\s+porcentaje\b/i;

const FILAS = /[;\n|]+/;

const CORTE = /(?<![\d.,/])(?=\d{1,3}\s+(?:viviend|casa|chalet|finca|parcela|plaza|pza|garaje|garage|aparcamiento|local|nave|almac[eé]n|oficina|edificio|piso|apartamento|estudio|trastero|solar|suelo|terreno|bodega|cochera))/i;

function legible(s) {
  return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CATEGORIA = [
  ['suelo', /finca|parcela|solar|suelo|terreno|monte|cultivo|rustic/i],
  ['vivienda', /viviend|casa|piso|apartamento|chalet|estudio/i],
  ['anejo', /garaje|garage|aparcamiento|trastero|cochera|plaza|pza/i],
  ['productivo', /local|nave|oficina|almacen|bodega|edificio/i]
];

const NOMBRE_CATEGORIA = {
  vivienda: ['vivienda', 'viviendas'],
  suelo: ['parcela o finca', 'parcelas y fincas'],
  anejo: ['garaje o trastero', 'garajes y trasteros'],
  productivo: ['local o nave', 'locales y naves'],
  otro: ['otro bien', 'otros bienes']
};

function categoriaDe(texto) {
  for (const [nombre, re] of CATEGORIA) if (re.test(texto)) return nombre;
  return 'otro';
}

function porcentajeDe(trozo) {
  const t = String(trozo);
  const m = t.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  if (m) {
    const v = Number(String(m[1]).replace(',', '.'));
    return Number.isFinite(v) && v > 0 && v <= 100 ? v : null;
  }
  const f = t.match(/(?:^|[^\d/])([1-9])\s*\/\s*([1-9]\d?)(?![\d/])/);
  if (f && Number(f[1]) < Number(f[2])) return (100 * Number(f[1])) / Number(f[2]);
  return null;
}

function origenDe(trozo) {
  return MARCA_SOCIEDAD.test(trozo) ? true : null;
}

function sinPorcentajeDe(trozo, pct) {
  return pct == null && SIN_PORCENTAJE.test(trozo);
}

const ES_VIVIENDA = /viviend|casa|piso|apartamento|chalet|estudio/i;

function itemsDeTrozo(original, fila) {
  const trozo = normalizar(original);
  const propio = porcentajeDe(trozo);
  const pct = propio ?? fila.pct;
  const sociedad = origenDe(trozo) ?? fila.sociedad;
  const sinPorcentaje = pct == null && (SIN_PORCENTAJE.test(trozo) || fila.sinPorcentaje);
  const out = [];

  const conNum = trozo.match(new RegExp(`^(\\d{1,3})\\s+(${TIPO.source})\\b`, 'i'));
  if (conNum) {
    const tipo = conNum[2];
    out.push({
      qty: Math.min(80, Number(conNum[1])),
      texto: original,
      porcentaje: pct,
      sinPorcentaje,
      sociedad,
      categoria: categoriaDe(tipo) === 'otro' ? categoriaDe(trozo) : categoriaDe(tipo),
      esVivienda: ES_VIVIENDA.test(tipo)
    });
    return out;
  }

  const menciones = [...trozo.matchAll(new RegExp(`\\b(${TIPO.source})\\b`, 'gi'))];
  if (menciones.length === 0) {
    if (/propiedad|herencia|inmueble|rustic|urban|%|provincia|madrid|barcelona|leon|almeria|coruna|sevilla|valencia/i.test(trozo) && trozo.length > 12) {
      out.push({ qty: 1, texto: original, porcentaje: pct, sinPorcentaje, sociedad, categoria: categoriaDe(trozo), esVivienda: false });
    }
    return out;
  }
  for (const m of menciones) {
    out.push({
      qty: 1,
      texto: menciones.length > 1 ? `${m[1]} — ${original}` : original,
      porcentaje: pct,
      sinPorcentaje,
      sociedad,
      categoria: categoriaDe(m[1]),
      esVivienda: ES_VIVIENDA.test(m[1])
    });
  }
  return out;
}

function desgloseDeFila(resto, original, fila) {
  const out = [];
  for (const parte of resto.split(CORTE).map(t => t.trim()).filter(Boolean)) {
    const trozo = normalizar(parte);
    const propio = porcentajeDe(trozo);
    const pct = propio ?? fila.pct;
    const sociedad = origenDe(trozo) ?? fila.sociedad;
    const sinPorcentaje = pct == null && (SIN_PORCENTAJE.test(trozo) || fila.sinPorcentaje);
    const cabeza = trozo.match(new RegExp(`^(\\d{1,3})\\s+(?=${TIPO.source})`, 'i'));
    const menciones = [...trozo.matchAll(new RegExp(`\\b(${TIPO.source})\\b`, 'gi'))];
    menciones.forEach((m, i) => out.push({
      qty: i === 0 && cabeza ? Math.min(80, Number(cabeza[1])) : 1,
      texto: `${m[1]} — ${original}`,
      porcentaje: pct,
      sinPorcentaje,
      sociedad,
      categoria: categoriaDe(m[1]),
      esVivienda: ES_VIVIENDA.test(m[1])
    }));
  }
  return out;
}

export function parsearInmueblesDetalle(detalle) {
  if (!detalle) return [];
  const out = [];
  for (const original of legible(detalle).split(FILAS).map(t => t.trim()).filter(Boolean)) {
    const normal = normalizar(original);
    const pct = porcentajeDe(normal);
    const fila = { pct, sociedad: origenDe(normal), sinPorcentaje: sinPorcentajeDe(normal, pct) };

    const total = normal.match(new RegExp(`^(\\d{1,3})\\s+(${TIPO.source})\\b`, 'i'));
    if (total && !/s$/i.test(total[2].split(/\s+/)[0])) {
      const alternativa = desgloseDeFila(original.replace(/^\s*\d{1,3}\s+/, ''), original, fila);
      const suma = alternativa.reduce((a, it) => a + it.qty, 0);
      if (alternativa.length > 1 && suma === Number(total[1])) {
        out.push(...alternativa);
        continue;
      }
    }

    for (const trozo of original.split(CORTE).map(t => t.trim()).filter(Boolean)) {
      out.push(...itemsDeTrozo(trozo, fila));
    }
  }
  return out;
}

export function contarInmuebles(detalle, urbanos = null, rusticos = null, detallePropios = null, detalleSociedad = null) {
  const hayDesglose = Boolean(detallePropios || detalleSociedad);
  const desgloseFiable = hayDesglose;

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
  let viviendasPropias = 0;
  let viviendasEquivalentes = 0;
  let equivalentes = 0;
  let sinPorcentaje = 0;
  const cats = { vivienda: 0, suelo: 0, anejo: 0, productivo: 0, otro: 0 };
  for (const it of items) {
    if (it.sociedad === true) sociedad += it.qty;
    else propios += it.qty;
    if (it.esVivienda && it.sociedad === false) {
      viviendasPropias += it.qty;
      if (!it.sinPorcentaje) viviendasEquivalentes += it.qty * ((it.porcentaje ?? 100) / 100);
    }
    if (it.sinPorcentaje) sinPorcentaje += it.qty;
    else equivalentes += it.qty * ((it.porcentaje ?? 100) / 100);
    cats[it.categoria ?? 'otro'] = (cats[it.categoria ?? 'otro'] ?? 0) + it.qty;
  }
  const total = propios + sociedad;
  equivalentes = Math.round(equivalentes * 10) / 10;
  viviendasEquivalentes = Math.round(viviendasEquivalentes * 10) / 10;

  if (total > 0) {
    return {
      n_inmuebles: total,
      n_inmuebles_propios: desgloseFiable ? propios : null,
      n_inmuebles_sociedad: desgloseFiable ? sociedad : null,
      n_inmuebles_equivalentes: equivalentes,
      n_inmuebles_sin_porcentaje: sinPorcentaje,
      n_viviendas: cats.vivienda,
      n_viviendas_propias: desgloseFiable ? viviendasPropias : null,
      n_viviendas_equivalentes: desgloseFiable ? viviendasEquivalentes : null,
      n_suelo: cats.suelo,
      n_anejos: cats.anejo,
      n_productivos: cats.productivo,
      n_otros_bienes: cats.otro,
      fuente: desgloseFiable ? 'desglose' : 'detalle',
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
      n_inmuebles_equivalentes: null,
      n_inmuebles_sin_porcentaje: null,
      n_viviendas: null,
      n_viviendas_propias: null,
      n_viviendas_equivalentes: null,
      n_suelo: null, n_anejos: null, n_productivos: null, n_otros_bienes: null,
      fuente: 'filas',
      items
    };
  }

  return {
    n_inmuebles: null,
    n_inmuebles_propios: null,
    n_inmuebles_sociedad: null,
    n_inmuebles_equivalentes: null,
    n_inmuebles_sin_porcentaje: null,
    n_viviendas: null,
    n_viviendas_propias: null,
    n_viviendas_equivalentes: null,
    n_suelo: null, n_anejos: null, n_productivos: null, n_otros_bienes: null,
    fuente: null,
    items
  };
}

export function desgloseBienes(d) {
  if (!d) return [];
  const partes = [
    ['vivienda', d.n_viviendas],
    ['suelo', d.n_suelo],
    ['productivo', d.n_productivos],
    ['anejo', d.n_anejos],
    ['otro', d.n_otros_bienes]
  ];
  return partes
    .filter(([, n]) => Number(n) > 0)
    .map(([cat, n]) => ({
      categoria: cat,
      n: Number(n),
      texto: `${n} ${NOMBRE_CATEGORIA[cat][Number(n) === 1 ? 0 : 1]}`
    }));
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