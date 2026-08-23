export interface VehiculoItem {
  tipo: 'coche' | 'moto' | 'embarcacion' | 'aeronave' | 'otro';
  texto: string;
}

export interface ConteoVehiculos {
  n_vehiculos: number;
  n_coches: number;
  n_motos: number;
  n_embarcaciones: number;
  n_aeronaves: number;
  n_otros: number;
  vehiculos_lista: VehiculoItem[];
}

export function clasificarVehiculos(
  detalle?: string | null,
  totalDeclarado?: number | string | null
): ConteoVehiculos;
