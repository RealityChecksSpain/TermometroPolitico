export type Mayoria = 'simple' | 'absoluta' | 'tres_quintos';

export const ESCANOS_CONGRESO = 350;
export const MAYORIA_ABSOLUTA = 176;
export const TRES_QUINTOS = 210;

const CONJUNTO = /votaci[óo]n\s+de\s+conjunto/i;
const CONSTITUCIONAL = /reforma\s+constitucional|reforma\s+de\s+la\s+constituci[óo]n|reforma\s+del\s+art[íi]culo\s+[\d.]+\s+de\s+la\s+constituci[óo]n/i;
const ABSOLUTA = /car[áa]cter\s+org[áa]nico|ley\s+org[áa]nica|reforma\s+del\s+reglamento\s+del\s+congreso/i;

export interface TextoVotacion {
  titulo?: string | null;
  subtitulo?: string | null;
}

export interface TotalesVotacion {
  total_si?: number | null;
  total_no?: number | null;
}

export function mayoriaRequerida(v: TextoVotacion): Mayoria {
  const texto = `${v.titulo ?? ''} ${v.subtitulo ?? ''}`;
  if (!CONJUNTO.test(texto)) return 'simple';
  if (CONSTITUCIONAL.test(texto)) return 'tres_quintos';
  if (ABSOLUTA.test(texto)) return 'absoluta';
  return 'simple';
}

export function umbralDe(m: Mayoria): number | null {
  if (m === 'absoluta') return MAYORIA_ABSOLUTA;
  if (m === 'tres_quintos') return TRES_QUINTOS;
  return null;
}

export function nombreMayoria(m: Mayoria): string {
  if (m === 'absoluta') return 'mayoría absoluta';
  if (m === 'tres_quintos') return 'mayoría de tres quintos';
  return 'mayoría simple';
}

export function resultadoDe(v: TextoVotacion & TotalesVotacion): 'aprobada' | 'rechazada' {
  const si = Number(v.total_si ?? 0);
  const no = Number(v.total_no ?? 0);
  const umbral = umbralDe(mayoriaRequerida(v));
  if (umbral !== null) return si >= umbral ? 'aprobada' : 'rechazada';
  return si > no ? 'aprobada' : 'rechazada';
}

export function faltaronPara(v: TextoVotacion & TotalesVotacion): number {
  const si = Number(v.total_si ?? 0);
  const no = Number(v.total_no ?? 0);
  const umbral = umbralDe(mayoriaRequerida(v));
  if (umbral !== null) return Math.max(0, umbral - si);
  if (si > no) return 0;
  return Math.floor((no - si) / 2) + 1;
}
