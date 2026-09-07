import { EjeId, FUENTES, NOMBRE_EJE } from './escalas';

export type { EjeId };
export { FUENTES, NOMBRE_EJE };

export interface FilaConsenso {
  clave: string;
  tipo: string;
  nombre: string;
  nombre_corto: string | null;
  pais_nombre: string | null;
  partido_slug: string | null;
  eje: EjeId;
  valor: number;
  desviacion: number;
  n_fuentes: number;
  fuentes: string[];
  anio: number;
}

export interface PosicionConsenso {
  clave: string;
  partido: string | null;
  nombre: string;
  eje: EjeId;
  valor: number;
  desviacion: number;
  fuentesUsadas: string[];
  anio: number;
}

const porSlug = new Map<string, PosicionConsenso>();
const porClave = new Map<string, PosicionConsenso>();

export function cargarPosiciones(filas: FilaConsenso[]): number {
  porSlug.clear();
  porClave.clear();
  let cargadas = 0;
  for (const f of filas ?? []) {
    if (f.valor === null || f.valor === undefined) continue;
    const p: PosicionConsenso = {
      clave: f.clave,
      partido: f.partido_slug ?? null,
      nombre: f.nombre_corto || f.nombre,
      eje: f.eje,
      valor: Number(f.valor),
      desviacion: Number(f.desviacion ?? 0),
      fuentesUsadas: Array.isArray(f.fuentes) ? f.fuentes : [],
      anio: Number(f.anio ?? 0)
    };
    porClave.set(`${f.clave}|${f.eje}`, p);
    if (f.partido_slug) porSlug.set(`${f.partido_slug}|${f.eje}`, p);
    cargadas++;
  }
  return cargadas;
}

export function hayPosiciones(eje?: EjeId): boolean {
  if (!eje) return porSlug.size > 0;
  for (const k of porSlug.keys()) if (k.endsWith(`|${eje}`)) return true;
  return false;
}

export function cuantasPosiciones(): number {
  return porClave.size;
}

export function posicionConsenso(partido: string, eje: EjeId): PosicionConsenso | null {
  return porSlug.get(`${partido}|${eje}`) ?? null;
}

export function posicionPorClave(clave: string, eje: EjeId): PosicionConsenso | null {
  return porClave.get(`${clave}|${eje}`) ?? null;
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
  centroCamara: number | null;
  escanosAFavor: number;
  escanosEnContra: number;
  escanosSinPosicion: number;
  distanciaAlCentro: number | null;
  fuentes: string[];
}

export function centroGravedad(votos: VotoGrupo[], eje: EjeId): CentroGravedad {
  const fuentes = new Set<string>();
  let sinPosicion = 0;

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

  votos.forEach(v => {
    if (!posicionConsenso(v.partido, eje)) sinPosicion += v.escanos;
  });

  const aFavor = votos.filter(v => v.voto === 'si');
  const enContra = votos.filter(v => v.voto === 'no');

  const centroAFavor = ponderar(aFavor);
  const centroCamara = ponderar(votos);

  return {
    eje,
    centroAFavor,
    centroEnContra: ponderar(enContra),
    centroCamara,
    escanosAFavor: aFavor.reduce((a, v) => a + v.escanos, 0),
    escanosEnContra: enContra.reduce((a, v) => a + v.escanos, 0),
    escanosSinPosicion: sinPosicion,
    distanciaAlCentro:
      centroAFavor === null || centroCamara === null
        ? null
        : Number((centroAFavor - centroCamara).toFixed(2)),
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

  const buckets: Record<TramoBarra['tramo'], { escanos: number; partidos: string[] }> = {
    izquierda: { escanos: 0, partidos: [] },
    centro: { escanos: 0, partidos: [] },
    derecha: { escanos: 0, partidos: [] }
  };

  let clasificados = 0;

  aFavor.forEach(v => {
    const pos = posicionConsenso(v.partido, eje);
    if (!pos) return;
    const tramo: TramoBarra['tramo'] = pos.valor < 4 ? 'izquierda' : pos.valor > 6 ? 'derecha' : 'centro';
    buckets[tramo].escanos += v.escanos;
    buckets[tramo].partidos.push(v.partido);
    clasificados += v.escanos;
  });

  return (['izquierda', 'centro', 'derecha'] as const).map(tramo => ({
    tramo,
    escanos: buckets[tramo].escanos,
    porcentaje: clasificados === 0 ? 0 : Number(((buckets[tramo].escanos / clasificados) * 100).toFixed(1)),
    partidos: buckets[tramo].partidos
  }));
}

export function textoProcedencia(cg: CentroGravedad): string | null {
  if (!cg.fuentes.length) return null;
  const nombres = cg.fuentes
    .map(f => FUENTES[f]?.nombre ?? f)
    .join(' · ');
  const aviso = cg.escanosSinPosicion > 0
    ? ` No entran en el calculo ${cg.escanosSinPosicion} escanos de partidos sin posicion externa publicada.`
    : '';
  return `Posiciones de partido segun ${nombres}. Votos segun el Congreso de los Diputados. ` +
    `Esta aplicacion no asigna ideologia a ninguna ley.${aviso}`;
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
