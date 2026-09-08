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
