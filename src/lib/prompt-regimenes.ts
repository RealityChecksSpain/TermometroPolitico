export const DIR = { type: 'string', enum: ['aumenta', 'reduce', 'neutro'] };

export const DIMENSIONES = [
  'gasto_publico', 'impuestos', 'regulacion_mercado', 'propiedad_publica',
  'proteccion_laboral', 'ortodoxia_fiscal',
  'derechos_individuales', 'apertura_migratoria', 'moral_tradicional',
  'religion_estado', 'orden_publico', 'diversidad_cultural', 'igualdad_trato',
  'nacionalismo'
] as const;

export type Dimension = typeof DIMENSIONES[number];

export const EJES_REGIMEN: Record<'izq_der' | 'con_pro', { dimension: Dimension; signo: 1 | -1 }[]> = {
  izq_der: [
    { dimension: 'gasto_publico', signo: -1 },
    { dimension: 'impuestos', signo: -1 },
    { dimension: 'regulacion_mercado', signo: -1 },
    { dimension: 'propiedad_publica', signo: -1 },
    { dimension: 'proteccion_laboral', signo: -1 },
    { dimension: 'ortodoxia_fiscal', signo: 1 }
  ],
  con_pro: [
    { dimension: 'derechos_individuales', signo: 1 },
    { dimension: 'apertura_migratoria', signo: 1 },
    { dimension: 'moral_tradicional', signo: 1 },
    { dimension: 'religion_estado', signo: 1 },
    { dimension: 'orden_publico', signo: 1 },
    { dimension: 'diversidad_cultural', signo: 1 },
    { dimension: 'igualdad_trato', signo: 1 },
    { dimension: 'nacionalismo', signo: -1 }
  ]
};

export const ESQUEMA_VALORES = {
  type: 'object',
  properties: Object.fromEntries(DIMENSIONES.map(d => [d, DIR])),
  required: [...DIMENSIONES],
  propertyOrdering: [...DIMENSIONES]
};

export const ESQUEMA = {
  type: 'object',
  properties: {
    ...Object.fromEntries(DIMENSIONES.map(d => [d, DIR])),
    citas: {
      type: 'object',
      properties: Object.fromEntries(DIMENSIONES.map(d => [d, { type: 'string' }]))
    }
  },
  required: [...DIMENSIONES]
};

export interface Regimen {
  clave: string;
  nombre: string;
  nombre_corto: string;
  pais_nombre: string;
  pais_vdem: string;
  desde: number;
  hasta: number;
  alcance: string;
}

export function prompt(r: Regimen): string {
  return `Codificas la POLITICA DOCUMENTADA de un regimen historico segun catorce dimensiones de hecho.
No opinas sobre si el regimen era bueno o malo, ni sobre su lugar en ningun eje ideologico.
Solo describes que hizo con cada materia respecto a la situacion que habia antes de llegar al poder.

REGIMEN: ${r.nombre}
PAIS: ${r.pais_nombre}
PERIODO: ${r.desde}-${r.hasta}
ALCANCE: ${r.alcance}

Para cada dimension responde "aumenta", "reduce" o "neutro".
"neutro" cuando el regimen no altero esa materia de forma sustancial respecto al periodo
anterior, o cuando la evidencia historiografica esta dividida. Es la respuesta por defecto.
Ante duda, "neutro".

1. gasto_publico        aumenta: amplia gasto estatal, obra publica, prestaciones o militarizacion presupuestaria.
                        reduce: recorta gasto estatal de forma sostenida.
2. impuestos            aumenta: sube la carga fiscal o crea nuevos tributos generales.
                        reduce: baja la carga fiscal de forma sostenida.
3. regulacion_mercado   aumenta: impone controles de precios, cupos, licencias o direccion estatal de la produccion.
                        reduce: liberaliza precios, desregula sectores o abre la competencia.
4. propiedad_publica    aumenta: nacionaliza, colectiviza o crea empresa estatal.
                        reduce: privatiza o devuelve al sector privado.
5. proteccion_laboral   aumenta: refuerza derechos laborales efectivos y negociacion colectiva libre.
                        reduce: suprime sindicatos libres, prohibe la huelga o debilita la negociacion.
                        Sindicato unico obligatorio controlado por el Estado es "reduce".
6. ortodoxia_fiscal     aumenta: prioriza equilibrio presupuestario, estabilidad monetaria y reduccion de deuda.
                        reduce: recurre al deficit o a la emision como politica habitual.
                        Sentido invertido: "aumenta" es mas disciplina fiscal.
7. derechos_individuales  aumenta: amplia libertades personales, intimidad, expresion o autonomia sobre la propia conducta.
                          reduce: restringe expresion, reunion, movimiento o autonomia personal.
8. apertura_migratoria    aumenta: facilita entrada, acogida o naturalizacion.
                          reduce: cierra fronteras, expulsa poblacion o restringe la ciudadania por origen.
9. moral_tradicional      aumenta: amplia aborto, divorcio, autonomia sexual o igualdad de genero en la ley.
                          reduce: restringe esas materias o impone un modelo unico de familia.
10. religion_estado       aumenta: retira privilegios, financiacion o simbolos confesionales de lo publico.
                          reduce: amplia privilegios, financiacion o control confesional de la educacion.
                          Un regimen que persigue toda religion tambien esta en "aumenta": mide laicidad del Estado, no libertad religiosa.
11. orden_publico         aumenta: limita el poder policial, rebaja penas o refuerza garantias procesales.
                          reduce: amplia poderes policiales, vigilancia, detencion sin juicio o pena de muerte.
12. diversidad_cultural   aumenta: protege lenguas, culturas o minorias, o reconoce pluralidad.
                          reduce: impone asimilacion, prohibe lenguas o persigue minorias.
13. igualdad_trato        aumenta: amplia el acceso y la proteccion frente a la discriminacion por origen, religion, genero, clase o discapacidad.
                          reduce: instaura discriminacion legal por cualquiera de esos motivos.
14. nacionalismo          aumenta: refuerza simbolos, lengua unica, irredentismo o identidad nacional excluyente.
                          reduce: relativiza la identidad nacional o cede soberania.

REGLAS ESTRICTAS:
- Codifica la politica efectivamente aplicada y documentada, no la proclamada en discursos ni programas.
- Codifica el periodo indicado en conjunto. Si la politica cambio de signo dentro del periodo, responde "neutro".
- No compares con otros regimenes ni con ningun eje politico. Solo con la situacion previa en ese pais.
- No uses las respuestas de unas dimensiones para deducir las de otras.
- En "citas" indica, para cada dimension que no sea neutro, la medida concreta y su fecha
  (por ejemplo una ley, un decreto o un plan). Sin generalidades.

Responde solo el JSON.`;
}

function textoCita(x: any): string {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map(textoCita).filter(Boolean).join('; ');
  if (typeof x === 'object') {
    const partes = [x.medida, x.norma, x.ley, x.descripcion, x.texto, x.fecha, x.anio]
      .map((v: any) => (typeof v === 'string' || typeof v === 'number' ? String(v) : ''))
      .filter(Boolean);
    return partes.join(' · ');
  }
  return '';
}

export function normalizarRespuesta(datos: any): {
  valores: Record<string, string>;
  citas: Record<string, string>;
} {
  const valores: Record<string, string> = {};
  const citas: Record<string, string> = {};
  const globales = datos?.citas ?? {};

  for (const d of DIMENSIONES) {
    const bruto = datos?.[d];
    let valor = '';
    let cita = '';

    if (typeof bruto === 'string') {
      valor = bruto.trim().toLowerCase();
    } else if (bruto && typeof bruto === 'object' && !Array.isArray(bruto)) {
      const candidato = bruto.valor ?? bruto.value ?? bruto.direccion ?? bruto.respuesta;
      if (typeof candidato === 'string') valor = candidato.trim().toLowerCase();
      cita = textoCita(bruto.citas ?? bruto.cita ?? bruto.fuente);
    }

    if (!cita) cita = textoCita(globales?.[d]);
    if (['aumenta', 'reduce', 'neutro'].includes(valor)) valores[d] = valor;
    if (cita) citas[d] = cita;
  }

  return { valores, citas };
}

export function posicionDesdeVotos(
  votos: Record<string, string>,
  eje: 'izq_der' | 'con_pro'
): { valor: number; usadas: string[] } | null {
  const usadas: string[] = [];
  let suma = 0;
  for (const { dimension, signo } of EJES_REGIMEN[eje]) {
    const v = votos[dimension];
    if (v !== 'aumenta' && v !== 'reduce') continue;
    usadas.push(dimension);
    suma += (v === 'aumenta' ? 1 : -1) * signo;
  }
  if (!usadas.length) return null;
  const media = suma / usadas.length;
  const valor = Math.min(10, Math.max(0, 5 + media * 5));
  return { valor, usadas };
}