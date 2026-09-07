export interface PaisCHES {
  abreviatura: string;
  nombre: string;
}

export const PAISES_CHES: Record<string, PaisCHES> = {
  '1': { abreviatura: 'BE', nombre: 'Belgica' },
  '2': { abreviatura: 'DK', nombre: 'Dinamarca' },
  '3': { abreviatura: 'GE', nombre: 'Alemania' },
  '4': { abreviatura: 'GR', nombre: 'Grecia' },
  '5': { abreviatura: 'ESP', nombre: 'Espana' },
  '6': { abreviatura: 'FR', nombre: 'Francia' },
  '7': { abreviatura: 'IRL', nombre: 'Irlanda' },
  '8': { abreviatura: 'IT', nombre: 'Italia' },
  '10': { abreviatura: 'NL', nombre: 'Paises Bajos' },
  '11': { abreviatura: 'UK', nombre: 'Reino Unido' },
  '12': { abreviatura: 'POR', nombre: 'Portugal' },
  '13': { abreviatura: 'AUS', nombre: 'Austria' },
  '14': { abreviatura: 'FIN', nombre: 'Finlandia' },
  '16': { abreviatura: 'SV', nombre: 'Suecia' },
  '20': { abreviatura: 'BUL', nombre: 'Bulgaria' },
  '21': { abreviatura: 'CZ', nombre: 'Republica Checa' },
  '22': { abreviatura: 'EST', nombre: 'Estonia' },
  '23': { abreviatura: 'HUN', nombre: 'Hungria' },
  '24': { abreviatura: 'LAT', nombre: 'Letonia' },
  '25': { abreviatura: 'LITH', nombre: 'Lituania' },
  '26': { abreviatura: 'POL', nombre: 'Polonia' },
  '27': { abreviatura: 'ROM', nombre: 'Rumania' },
  '28': { abreviatura: 'SLO', nombre: 'Eslovaquia' },
  '29': { abreviatura: 'SLE', nombre: 'Eslovenia' },
  '31': { abreviatura: 'CRO', nombre: 'Croacia' },
  '37': { abreviatura: 'MAL', nombre: 'Malta' },
  '38': { abreviatura: 'LUX', nombre: 'Luxemburgo' },
  '40': { abreviatura: 'CYP', nombre: 'Chipre' }
};

export function decodificarPais(fuente: string, valor: string): { codigo: string | null; nombre: string } {
  if (fuente !== 'ches') return { codigo: null, nombre: String(valor ?? '').trim() };
  const clave = String(valor ?? '').trim();
  const p = PAISES_CHES[clave];
  return p ? { codigo: p.abreviatura, nombre: p.nombre } : { codigo: null, nombre: clave };
}
