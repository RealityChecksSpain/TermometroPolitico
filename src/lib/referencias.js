import { supabase } from './cliente.js';

export async function traerReferencias() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_referencias_mapa')
    .select('clave, tipo, nombre, nombre_corto, pais_codigo, pais_nombre, partido_slug, x, y, ex, ey, n_x, n_y, anio, fuentes, territorial, democracia, democracia_desde, democracia_hasta');
  if (error || !data) return [];
  return data
    .filter(r => r.x !== null && r.x !== undefined && r.y !== null && r.y !== undefined)
    .map(r => ({
      clave: r.clave,
      tipo: r.tipo,
      nombre: r.nombre,
      nombre_corto: r.nombre_corto,
      pais_codigo: r.pais_codigo,
      pais_nombre: r.pais_nombre,
      partido_slug: r.partido_slug,
      x: Number(r.x),
      y: Number(r.y),
      ex: Number(r.ex ?? 0),
      ey: Number(r.ey ?? 0),
      n_x: Number(r.n_x ?? 1),
      n_y: Number(r.n_y ?? 1),
      anio: Number(r.anio ?? 0),
      fuentes: Array.isArray(r.fuentes) ? r.fuentes : [],
      territorial: r.territorial === null || r.territorial === undefined ? null : Number(r.territorial),
      democracia: r.democracia === null || r.democracia === undefined ? null : Number(r.democracia),
      democracia_desde: r.democracia_desde === null || r.democracia_desde === undefined ? null : Number(r.democracia_desde),
      democracia_hasta: r.democracia_hasta === null || r.democracia_hasta === undefined ? null : Number(r.democracia_hasta)
    }));
}

export async function traerFuentesExternas() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('fuentes_externas')
    .select('id, nombre, institucion, tipo, url, licencia, cita, ola');
  if (error || !data) return [];
  return data;
}

export const EJE_DIMENSION = {
  gasto_publico: 'izq_der',
  impuestos: 'izq_der',
  regulacion_mercado: 'izq_der',
  propiedad_publica: 'izq_der',
  proteccion_laboral: 'izq_der',
  ortodoxia_fiscal: 'izq_der',
  derechos_individuales: 'con_pro',
  apertura_migratoria: 'con_pro',
  moral_tradicional: 'con_pro',
  religion_estado: 'con_pro',
  orden_publico: 'con_pro',
  diversidad_cultural: 'con_pro',
  igualdad_trato: 'con_pro',
  nacionalismo: 'con_pro'
};

export const NOMBRE_DIMENSION = {
  gasto_publico: 'gasto público',
  impuestos: 'impuestos',
  regulacion_mercado: 'regulación del mercado',
  propiedad_publica: 'propiedad pública',
  proteccion_laboral: 'protección laboral',
  ortodoxia_fiscal: 'ortodoxia fiscal',
  derechos_individuales: 'derechos individuales',
  apertura_migratoria: 'apertura migratoria',
  moral_tradicional: 'moral tradicional',
  religion_estado: 'religión y Estado',
  orden_publico: 'orden público',
  diversidad_cultural: 'diversidad cultural',
  igualdad_trato: 'igualdad de trato',
  nacionalismo: 'nacionalismo'
};

export async function traerDimensionesRegimen() {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('v_regimen_dimensiones')
    .select('entidad_clave, clave_mapa, dimension, valor, votantes, acuerdo, cita, respuestas_distintas');
  if (error || !data) return {};
  const salida = {};
  for (const f of data) {
    if (!salida[f.clave_mapa]) salida[f.clave_mapa] = [];
    salida[f.clave_mapa].push({
      dimension: f.dimension,
      valor: f.valor,
      votantes: Number(f.votantes ?? 0),
      acuerdo: Number(f.acuerdo ?? 0),
      cita: f.cita ?? null,
      distintas: Number(f.respuestas_distintas ?? 1),
      eje: EJE_DIMENSION[f.dimension] ?? null
    });
  }
  return salida;
}