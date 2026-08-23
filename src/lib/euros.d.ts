export function sanearImporte(n: number | string | null | undefined): number | null;

export function parseEuroES(raw: string | number | null | undefined): number | null;

export function sanearDeclaracion<T extends Record<string, any>>(d: T): T;

export function patrimonioLiquido(d: Record<string, any> | null | undefined): number | null;

export const UMBRAL: {
  depositosSospechosos: number;
  patrimonioAlto: number;
  patrimonioBajo: number;
  patrimonioAbsurdo: number;
  inmueblesAbsurdo: number;
};

export function motivoAnomalia(d: Record<string, any> | null | undefined): string | null;
