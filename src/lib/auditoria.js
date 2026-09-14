import { supabase } from './cliente.js';

export const EJE_DE_DIMENSION = {
  gasto_publico: 'economico',
  impuestos: 'economico',
  regulacion_mercado: 'economico',
  propiedad_publica: 'economico',
  proteccion_laboral: 'economico',
  proteccionismo: 'economico',
  derechos_individuales: 'social',
  apertura_migratoria: 'social',
  moral_tradicional: 'social',
  religion_estado: 'social',
  orden_publico: 'social',
  diversidad_cultural: 'social',
  nacionalismo: 'social',
  autoridad_estatal: 'social',
  descentralizacion: 'territorial',
  integracion_europea: 'territorial'
};

export const FUERA_DE_EJE = ['ortodoxia_fiscal', 'igualdad_trato', 'medio_ambiente', 'calidad_democratica'];

export const NOMBRE_DIMENSION_LEY = {
  gasto_publico: 'gasto público',
  impuestos: 'impuestos',
  regulacion_mercado: 'regulación de empresas',
  propiedad_publica: 'propiedad pública',
  proteccion_laboral: 'protección laboral',
  proteccionismo: 'proteccionismo',
  derechos_individuales: 'derechos individuales',
  apertura_migratoria: 'migración',
  moral_tradicional: 'moral y familia',
  religion_estado: 'religión y Estado',
  orden_publico: 'orden público',
  diversidad_cultural: 'diversidad cultural',
  nacionalismo: 'nacionalismo',
  autoridad_estatal: 'autoridad del Ejecutivo',
  descentralizacion: 'descentralización',
  integracion_europea: 'integración europea',
  ortodoxia_fiscal: 'ortodoxia fiscal',
  igualdad_trato: 'igualdad de trato',
  medio_ambiente: 'medio ambiente',
  calidad_democratica: 'calidad democrática'
};

export const NOMBRE_EJE_LEY = {
  economico: 'económico',
  social: 'social',
  territorial: 'territorial'
};

export function nombrarDimensiones(claves) {
  const lista = (claves ?? []).map(d => NOMBRE_DIMENSION_LEY[d] ?? d);
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

export async function traerAuditoriaPlacebo() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('auditoria_placebo')
    .select('eje, reps, dimensiones, dimensiones_fuera, p_valor, rango_observado, placebo_p95, bimodalidad_observada, calculado_at');
  if (error || !data || data.length === 0) return null;
  return data.map(f => ({
    eje: f.eje,
    reps: Number(f.reps ?? 0),
    dimensiones: Array.isArray(f.dimensiones) ? f.dimensiones : [],
    fuera: Array.isArray(f.dimensiones_fuera) ? f.dimensiones_fuera : [],
    p: f.p_valor === null || f.p_valor === undefined ? null : Number(f.p_valor),
    rango: f.rango_observado === null || f.rango_observado === undefined ? null : Number(f.rango_observado),
    placeboP95: f.placebo_p95 === null || f.placebo_p95 === undefined ? null : Number(f.placebo_p95),
    bimodalidad: f.bimodalidad_observada === null || f.bimodalidad_observada === undefined ? null : Number(f.bimodalidad_observada),
    calculado: f.calculado_at ?? null
  }));
}

export const UMBRAL_KAPPA = 0.40;
export const KAPPA_SOLIDA = 0.60;

export function veredictoKappa(k) {
  if (k === null || k === undefined) return 'sin base';
  if (k >= 0.80) return 'casi perfecto';
  if (k >= 0.60) return 'sustancial';
  if (k >= UMBRAL_KAPPA) return 'moderado';
  if (k >= 0.20) return 'débil';
  return 'insuficiente';
}

export async function traerAuditoriaFiabilidad() {
  if (!supabase) return null;
  const { data: activa } = await supabase
    .from('v_version_codigo_activa')
    .select('version_prompt')
    .maybeSingle();
  const version = activa?.version_prompt ?? null;
  if (!version) return null;
  const { data, error } = await supabase
    .from('auditoria_fiabilidad')
    .select('dimension, muestra, marcadas, modelo_a, modelo_b, version_prompt, acuerdo, kappa, calculado_at')
    .eq('version_prompt', version);
  if (error || !data || data.length === 0) return null;
  return data.map(f => ({
    dimension: f.dimension,
    muestra: Number(f.muestra ?? 0),
    marcadas: Number(f.marcadas ?? 0),
    modeloA: f.modelo_a ?? null,
    modeloB: f.modelo_b ?? null,
    version: f.version_prompt ?? null,
    acuerdo: f.acuerdo === null || f.acuerdo === undefined ? null : Number(f.acuerdo),
    kappa: f.kappa === null || f.kappa === undefined ? null : Number(f.kappa),
    calculado: f.calculado_at ?? null
  }));
}

export function indiceKappa(fiabilidad) {
  const indice = {};
  for (const f of fiabilidad ?? []) indice[f.dimension] = f.kappa;
  return indice;
}

export async function traerBaseProgramas() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('mv_eje_programa').select('*');
  if (error || !data || data.length === 0) return null;
  const num = v => (v === null || v === undefined || v === '' ? null : Number(v));
  const filas = data
    .map(f => ({
      partido: f.partido ?? null,
      siglas: String(f.siglas ?? f.partido ?? '').trim(),
      promesas: num(f.promesas),
      economico: num(f.eje_economico),
      social: num(f.eje_social),
      baseEconomico: num(f.base_economico),
      baseSocial: num(f.base_social),
      dimsEconomico: num(f.dimensiones_economicas),
      dimsSocial: num(f.dimensiones_sociales)
    }))
    .filter(f => f.siglas);
  return filas.length ? filas : null;
}