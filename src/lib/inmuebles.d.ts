export interface InmuebleItem {
  qty: number;
  texto: string;
  porcentaje: number | null;
  sociedad: boolean;
  categoria: 'vivienda' | 'suelo' | 'anejo' | 'productivo' | 'otro';
  esVivienda: boolean;
}

export interface ConteoInmuebles {
  n_inmuebles: number | null;
  n_inmuebles_propios: number | null;
  n_inmuebles_sociedad: number | null;
  n_inmuebles_equivalentes: number | null;
  n_viviendas: number | null;
  n_suelo: number | null;
  n_anejos: number | null;
  n_productivos: number | null;
  n_otros_bienes: number | null;
  fuente: 'desglose' | 'detalle' | 'filas' | null;
  items: InmuebleItem[];
}

export function parsearInmueblesDetalle(detalle: string | null | undefined): InmuebleItem[];

export function contarInmuebles(
  detalle?: string | null,
  urbanos?: number | string | null,
  rusticos?: number | string | null,
  detallePropios?: string | null,
  detalleSociedad?: string | null
): ConteoInmuebles;

export function desgloseBienes(d: Record<string, any> | null | undefined): {
  categoria: string;
  n: number;
  texto: string;
}[];

export function resumirInmuebles(d: Record<string, any> | null | undefined): {
  total: number;
  propios: number | null;
  sociedad: number | null;
  desglosado: boolean;
} | null;