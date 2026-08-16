export type EjeId = 'izq_der' | 'territorial' | 'gal_tan';

export interface FuenteExterna {
  id: string;
  nombre: string;
  tipo: 'encuesta_expertos' | 'encuesta_ciudadana' | 'analisis_programas';
  institucion: string;
  url: string;
  escalaMin: number;
  escalaMax: number;
  ejes: EjeId[];
  ultimaOla: string;
}

export const FUENTES: Record<string, FuenteExterna> = {
  ches: {
    id: 'ches',
    nombre: 'Chapel Hill Expert Survey',
    tipo: 'encuesta_expertos',
    institucion: 'University of North Carolina at Chapel Hill',
    url: 'https://www.chesdata.eu',
    escalaMin: 0,
    escalaMax: 10,
    ejes: ['izq_der', 'territorial', 'gal_tan'],
    ultimaOla: 'pendiente_de_cargar'
  },
  cis: {
    id: 'cis',
    nombre: 'Barómetro CIS · autoubicación de partidos',
    tipo: 'encuesta_ciudadana',
    institucion: 'Centro de Investigaciones Sociológicas',
    url: 'https://www.cis.es',
    escalaMin: 1,
    escalaMax: 10,
    ejes: ['izq_der'],
    ultimaOla: 'pendiente_de_cargar'
  },
  marpor: {
    id: 'marpor',
    nombre: 'Manifesto Project · índice RILE',
    tipo: 'analisis_programas',
    institucion: 'WZB Berlin Social Science Center',
    url: 'https://manifesto-project.wzb.eu',
    escalaMin: -100,
    escalaMax: 100,
    ejes: ['izq_der'],
    ultimaOla: 'pendiente_de_cargar'
  }
};

export interface PosicionBruta {
  partido: string;
  fuente: string;
  eje: EjeId;
  valor: number;
  provisional: boolean;
}

export const POSICIONES_BRUTAS: PosicionBruta[] = [
  { partido: 'sumar', fuente: 'ches', eje: 'izq_der', valor: 1.8, provisional: true },
  { partido: 'psoe', fuente: 'ches', eje: 'izq_der', valor: 3.4, provisional: true },
  { partido: 'erc', fuente: 'ches', eje: 'izq_der', valor: 2.6, provisional: true },
  { partido: 'bildu', fuente: 'ches', eje: 'izq_der', valor: 1.5, provisional: true },
  { partido: 'bng', fuente: 'ches', eje: 'izq_der', valor: 2.1, provisional: true },
  { partido: 'pnv', fuente: 'ches', eje: 'izq_der', valor: 5.4, provisional: true },
  { partido: 'junts', fuente: 'ches', eje: 'izq_der', valor: 6.1, provisional: true },
  { partido: 'cc', fuente: 'ches', eje: 'izq_der', valor: 6.3, provisional: true },
  { partido: 'pp', fuente: 'ches', eje: 'izq_der', valor: 7.2, provisional: true },
  { partido: 'upn', fuente: 'ches', eje: 'izq_der', valor: 7.6, provisional: true },
  { partido: 'vox', fuente: 'ches', eje: 'izq_der', valor: 9.1, provisional: true },

  { partido: 'sumar', fuente: 'cis', eje: 'izq_der', valor: 2.2, provisional: true },
  { partido: 'psoe', fuente: 'cis', eje: 'izq_der', valor: 3.9, provisional: true },
  { partido: 'erc', fuente: 'cis', eje: 'izq_der', valor: 3.1, provisional: true },
  { partido: 'bildu', fuente: 'cis', eje: 'izq_der', valor: 2.0, provisional: true },
  { partido: 'bng', fuente: 'cis', eje: 'izq_der', valor: 2.7, provisional: true },
  { partido: 'pnv', fuente: 'cis', eje: 'izq_der', valor: 5.8, provisional: true },
  { partido: 'junts', fuente: 'cis', eje: 'izq_der', valor: 6.4, provisional: true },
  { partido: 'cc', fuente: 'cis', eje: 'izq_der', valor: 6.0, provisional: true },
  { partido: 'pp', fuente: 'cis', eje: 'izq_der', valor: 7.5, provisional: true },
  { partido: 'upn', fuente: 'cis', eje: 'izq_der', valor: 7.8, provisional: true },
  { partido: 'vox', fuente: 'cis', eje: 'izq_der', valor: 9.4, provisional: true },

  { partido: 'bildu', fuente: 'ches', eje: 'territorial', valor: 9.5, provisional: true },
  { partido: 'junts', fuente: 'ches', eje: 'territorial', valor: 9.7, provisional: true },
  { partido: 'erc', fuente: 'ches', eje: 'territorial', valor: 9.6, provisional: true },
  { partido: 'bng', fuente: 'ches', eje: 'territorial', valor: 9.2, provisional: true },
  { partido: 'pnv', fuente: 'ches', eje: 'territorial', valor: 8.9, provisional: true },
  { partido: 'cc', fuente: 'ches', eje: 'territorial', valor: 7.4, provisional: true },
  { partido: 'sumar', fuente: 'ches', eje: 'territorial', valor: 6.8, provisional: true },
  { partido: 'psoe', fuente: 'ches', eje: 'territorial', valor: 4.6, provisional: true },
  { partido: 'pp', fuente: 'ches', eje: 'territorial', valor: 1.9, provisional: true },
  { partido: 'upn', fuente: 'ches', eje: 'territorial', valor: 1.2, provisional: true },
  { partido: 'vox', fuente: 'ches', eje: 'territorial', valor: 0.4, provisional: true }
];

function normalizar(valor: number, fuente: FuenteExterna): number {
  const { escalaMin, escalaMax } = fuente;
  return ((valor - escalaMin) / (escalaMax - escalaMin)) * 10;
}

export interface PosicionConsenso {
  partido: string;
  eje: EjeId;
  valor: number;
  desviacion: number;
  fuentesUsadas: string[];
  provisional: boolean;
}

export function posicionConsenso(partido: string, eje: EjeId): PosicionConsenso | null {
  const brutas = POSICIONES_BRUTAS.filter(p => p.partido === partido && p.eje === eje);
  if (brutas.length === 0) return null;

  const normalizadas = brutas.map(b => normalizar(b.valor, FUENTES[b.fuente]));
  const media = normalizadas.reduce((a, b) => a + b, 0) / normalizadas.length;
  const varianza = normalizadas.reduce((a, b) => a + (b - media) ** 2, 0) / normalizadas.length;

  return {
    partido,
    eje,
    valor: Number(media.toFixed(2)),
    desviacion: Number(Math.sqrt(varianza).toFixed(2)),
    fuentesUsadas: brutas.map(b => b.fuente),
    provisional: brutas.some(b => b.provisional)
  };
}

export interface VotoGrupo {
  partido: string;
  escanos: number;
  voto: 'si' | 'no' | 'abstencion' | 'no_vota';
}

export interface CentroGravedad {
  eje: EjeId;
  centroAFavor: number | null;
  centroEnContra: number | null;
  centroCamara: number;
  escanosAFavor: number;
  escanosEnContra: number;
  distanciaAlCentro: number | null;
  fuentes: string[];
}

export function centroGravedad(votos: VotoGrupo[], eje: EjeId): CentroGravedad {
  const fuentes = new Set<string>();

  const ponderar = (subset: VotoGrupo[]) => {
    let suma = 0;
    let peso = 0;
    subset.forEach(v => {
      const pos = posicionConsenso(v.partido, eje);
      if (!pos) return;
      pos.fuentesUsadas.forEach(f => fuentes.add(f));
      suma += pos.valor * v.escanos;
      peso += v.escanos;
    });
    return peso === 0 ? null : Number((suma / peso).toFixed(2));
  };

  const aFavor = votos.filter(v => v.voto === 'si');
  const enContra = votos.filter(v => v.voto === 'no');

  const centroAFavor = ponderar(aFavor);
  const centroCamara = ponderar(votos) ?? 5;

  return {
    eje,
    centroAFavor,
    centroEnContra: ponderar(enContra),
    centroCamara,
    escanosAFavor: aFavor.reduce((a, v) => a + v.escanos, 0),
    escanosEnContra: enContra.reduce((a, v) => a + v.escanos, 0),
    distanciaAlCentro: centroAFavor === null ? null : Number((centroAFavor - centroCamara).toFixed(2)),
    fuentes: Array.from(fuentes)
  };
}

export interface TramoBarra {
  tramo: 'izquierda' | 'centro' | 'derecha';
  escanos: number;
  porcentaje: number;
  partidos: string[];
}

export function tramosDeApoyo(votos: VotoGrupo[], eje: EjeId = 'izq_der'): TramoBarra[] {
  const aFavor = votos.filter(v => v.voto === 'si');
  const total = aFavor.reduce((a, v) => a + v.escanos, 0);

  const buckets: Record<TramoBarra['tramo'], { escanos: number; partidos: string[] }> = {
    izquierda: { escanos: 0, partidos: [] },
    centro: { escanos: 0, partidos: [] },
    derecha: { escanos: 0, partidos: [] }
  };

  aFavor.forEach(v => {
    const pos = posicionConsenso(v.partido, eje);
    if (!pos) return;
    const tramo: TramoBarra['tramo'] = pos.valor < 4 ? 'izquierda' : pos.valor > 6 ? 'derecha' : 'centro';
    buckets[tramo].escanos += v.escanos;
    buckets[tramo].partidos.push(v.partido);
  });

  return (['izquierda', 'centro', 'derecha'] as const).map(tramo => ({
    tramo,
    escanos: buckets[tramo].escanos,
    porcentaje: total === 0 ? 0 : Number(((buckets[tramo].escanos / total) * 100).toFixed(1)),
    partidos: buckets[tramo].partidos
  }));
}

export function textoProcedencia(cg: CentroGravedad): string {
  const nombres = cg.fuentes.map(f => FUENTES[f].nombre).join(' · ');
  return `Posiciones de partido según ${nombres}. Votos según el Congreso de los Diputados. Esta aplicación no asigna ideología a ninguna ley.`;
}

export function votacionesFueraDeBloque(
  partido: string,
  votaciones: { id: string; titulo: string; votos: VotoGrupo[] }[],
  eje: EjeId = 'izq_der',
  umbral = 1.2
) {
  const propia = posicionConsenso(partido, eje);
  if (!propia) return [];

  return votaciones
    .map(v => {
      const suVoto = v.votos.find(x => x.partido === partido);
      if (!suVoto || suVoto.voto !== 'si') return null;
      const cg = centroGravedad(v.votos, eje);
      if (cg.centroAFavor === null) return null;
      const desvio = cg.centroAFavor - propia.valor;
      return Math.abs(desvio) >= umbral
        ? { id: v.id, titulo: v.titulo, desvio: Number(desvio.toFixed(2)), centroAFavor: cg.centroAFavor }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.desvio) - Math.abs(a!.desvio));
}
