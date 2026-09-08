import { supabase } from './cliente.js';

export const NOMBRE_ES = {
  Spain: 'España', France: 'Francia', Germany: 'Alemania', Italy: 'Italia',
  Portugal: 'Portugal', 'United Kingdom': 'Reino Unido', 'United States of America': 'Estados Unidos',
  Netherlands: 'Países Bajos', Belgium: 'Bélgica', Sweden: 'Suecia', Norway: 'Noruega',
  Denmark: 'Dinamarca', Finland: 'Finlandia', Switzerland: 'Suiza', Austria: 'Austria',
  Ireland: 'Irlanda', Greece: 'Grecia', Poland: 'Polonia', Hungary: 'Hungría',
  Romania: 'Rumanía', Bulgaria: 'Bulgaria', Czechia: 'Chequia', Slovakia: 'Eslovaquia',
  Croatia: 'Croacia', Slovenia: 'Eslovenia', Estonia: 'Estonia', Latvia: 'Letonia',
  Lithuania: 'Lituania', Russia: 'Rusia', Ukraine: 'Ucrania', Turkey: 'Turquía',
  China: 'China', Japan: 'Japón', India: 'India', Pakistan: 'Pakistán',
  Brazil: 'Brasil', Argentina: 'Argentina', Chile: 'Chile', Colombia: 'Colombia',
  Venezuela: 'Venezuela', Mexico: 'México', Peru: 'Perú', Uruguay: 'Uruguay',
  Bolivia: 'Bolivia', Ecuador: 'Ecuador', Cuba: 'Cuba', 'Dominican Republic': 'República Dominicana',
  Morocco: 'Marruecos', Algeria: 'Argelia', Tunisia: 'Túnez', Egypt: 'Egipto',
  'Saudi Arabia': 'Arabia Saudí', Qatar: 'Catar', Israel: 'Israel', Iran: 'Irán',
  'South Africa': 'Sudáfrica', Nigeria: 'Nigeria', Kenya: 'Kenia', Ethiopia: 'Etiopía',
  Australia: 'Australia', 'New Zealand': 'Nueva Zelanda', Canada: 'Canadá',
  'South Korea': 'Corea del Sur', 'North Korea': 'Corea del Norte', Vietnam: 'Vietnam',
  Indonesia: 'Indonesia', Philippines: 'Filipinas', Thailand: 'Tailandia', Singapore: 'Singapur'
};

export function nombrarPais(nombre) {
  return NOMBRE_ES[nombre] ?? nombre;
}

export async function traerDemocraciaActual() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_democracia_actual')
    .select('pais_codigo, pais_nombre, anio, elecciones, contrapesos, indicador_elecciones, indicador_contrapesos');
  if (error) throw error;
  return (data ?? []).map(f => ({
    codigo: f.pais_codigo,
    nombre: nombrarPais(f.pais_nombre),
    nombreFuente: f.pais_nombre,
    anio: Number(f.anio),
    x: Number(f.elecciones),
    y: Number(f.contrapesos),
    indicadorX: f.indicador_elecciones,
    indicadorY: f.indicador_contrapesos
  }));
}

export async function traerDemocraciaSerie(codigo) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_democracia_anio')
    .select('anio, elecciones, contrapesos')
    .eq('pais_codigo', codigo)
    .order('anio');
  if (error) throw error;
  return (data ?? []).map(f => ({
    anio: Number(f.anio),
    x: Number(f.elecciones),
    y: Number(f.contrapesos)
  }));
}

export function cuadrante(x, y) {
  const altoX = x >= 0.5;
  const altoY = y >= 0.5;
  if (altoX && altoY) return 'democracia_liberal';
  if (altoX && !altoY) return 'democracia_iliberal';
  if (!altoX && altoY) return 'autocracia_con_reglas';
  return 'autocracia_cerrada';
}

export const CUADRANTE = {
  democracia_liberal: {
    titulo: 'Democracia liberal',
    texto: 'Se puede echar al gobierno votando y además hay límites a lo que puede hacer quien gana.'
  },
  democracia_iliberal: {
    titulo: 'Democracia iliberal',
    texto: 'Hay elecciones que se pueden perder, pero quien gana encuentra pocos límites: tribunales, prensa y parlamento pesan poco.'
  },
  autocracia_con_reglas: {
    titulo: 'Autocracia con reglas',
    texto: 'Existen tribunales y procedimientos que funcionan, pero el poder no se decide en unas elecciones que el gobierno pueda perder.'
  },
  autocracia_cerrada: {
    titulo: 'Autocracia cerrada',
    texto: 'Ni elecciones que se puedan perder ni contrapesos que limiten al que manda.'
  }
};
