export type Ambito = 'nacional' | 'madrid' | 'ambos';

export interface Partido {
  slug: string;
  siglas: string;
  nombre: string;
  color: string;
  colorSuave: string;
  colorTexto: string;
  luminosidad: number;
  familia: 'rojo' | 'azul' | 'verde' | 'ambar' | 'morado' | 'naranja' | 'turquesa' | 'neutro';
  ambito: Ambito;
}

export const PARTIDOS: Record<string, Partido> = {
  psoe: {
    slug: 'psoe',
    siglas: 'PSOE',
    nombre: 'Partido Socialista Obrero Español',
    color: '#C8102E',
    colorSuave: '#FBE9EC',
    colorTexto: '#8E0B20',
    luminosidad: 42,
    familia: 'rojo',
    ambito: 'ambos'
  },
  pp: {
    slug: 'pp',
    siglas: 'PP',
    nombre: 'Partido Popular',
    color: '#0B4DA2',
    colorSuave: '#E7EEF8',
    colorTexto: '#083A79',
    luminosidad: 35,
    familia: 'azul',
    ambito: 'ambos'
  },
  vox: {
    slug: 'vox',
    siglas: 'VOX',
    nombre: 'VOX',
    color: '#5BC236',
    colorSuave: '#EDF9E8',
    colorTexto: '#33701E',
    luminosidad: 70,
    familia: 'verde',
    ambito: 'ambos'
  },
  sumar: {
    slug: 'sumar',
    siglas: 'SUMAR',
    nombre: 'Sumar',
    color: '#B5227A',
    colorSuave: '#F9E9F2',
    colorTexto: '#84195A',
    luminosidad: 44,
    familia: 'morado',
    ambito: 'nacional'
  },
  podemos: {
    slug: 'podemos',
    siglas: 'PODEMOS',
    nombre: 'Podemos',
    color: '#6A2E7C',
    colorSuave: '#F0E9F3',
    colorTexto: '#4E2159',
    luminosidad: 32,
    familia: 'morado',
    ambito: 'ambos'
  },
  erc: {
    slug: 'erc',
    siglas: 'ERC',
    nombre: 'Esquerra Republicana de Catalunya',
    color: '#F2A81C',
    colorSuave: '#FDF3E2',
    colorTexto: '#8A5D06',
    luminosidad: 74,
    familia: 'ambar',
    ambito: 'nacional'
  },
  junts: {
    slug: 'junts',
    siglas: 'JUNTS',
    nombre: 'Junts per Catalunya',
    color: '#6FD3E8',
    colorSuave: '#EAF9FC',
    colorTexto: '#186273',
    luminosidad: 79,
    familia: 'azul',
    ambito: 'nacional'
  },
  bildu: {
    slug: 'bildu',
    siglas: 'EH BILDU',
    nombre: 'Euskal Herria Bildu',
    color: '#8A9B0F',
    colorSuave: '#F3F5E3',
    colorTexto: '#5C6709',
    luminosidad: 58,
    familia: 'verde',
    ambito: 'nacional'
  },
  pnv: {
    slug: 'pnv',
    siglas: 'PNV',
    nombre: 'Partido Nacionalista Vasco',
    color: '#00693C',
    colorSuave: '#E3F1EA',
    colorTexto: '#004E2C',
    luminosidad: 32,
    familia: 'verde',
    ambito: 'nacional'
  },
  bng: {
    slug: 'bng',
    siglas: 'BNG',
    nombre: 'Bloque Nacionalista Galego',
    color: '#1B9AD6',
    colorSuave: '#E5F3FB',
    colorTexto: '#116A94',
    luminosidad: 58,
    familia: 'azul',
    ambito: 'nacional'
  },
  cc: {
    slug: 'cc',
    siglas: 'CC',
    nombre: 'Coalición Canaria',
    color: '#E8D019',
    colorSuave: '#FCF9E0',
    colorTexto: '#7D700A',
    luminosidad: 84,
    familia: 'ambar',
    ambito: 'nacional'
  },
  upn: {
    slug: 'upn',
    siglas: 'UPN',
    nombre: 'Unión del Pueblo Navarro',
    color: '#8E9299',
    colorSuave: '#F1F2F3',
    colorTexto: '#5A5E64',
    luminosidad: 62,
    familia: 'neutro',
    ambito: 'nacional'
  },
  masmadrid: {
    slug: 'masmadrid',
    siglas: 'MÁS MADRID',
    nombre: 'Más Madrid',
    color: '#00A99D',
    colorSuave: '#E2F5F3',
    colorTexto: '#00736B',
    luminosidad: 62,
    familia: 'turquesa',
    ambito: 'madrid'
  },
  ciudadanos: {
    slug: 'ciudadanos',
    siglas: 'CS',
    nombre: 'Ciudadanos',
    color: '#EB6109',
    colorSuave: '#FDEDE2',
    colorTexto: '#9C4106',
    luminosidad: 60,
    familia: 'naranja',
    ambito: 'ambos'
  },
  mixto: {
    slug: 'mixto',
    siglas: 'MIXTO',
    nombre: 'Grupo Mixto',
    color: '#9AA0A6',
    colorSuave: '#F2F3F4',
    colorTexto: '#5F6368',
    luminosidad: 66,
    familia: 'neutro',
    ambito: 'ambos'
  },
  sinGrupo: {
    slug: 'sinGrupo',
    siglas: 'S/G',
    nombre: 'Sin grupo',
    color: '#C4C8CC',
    colorSuave: '#F7F8F8',
    colorTexto: '#70757A',
    luminosidad: 80,
    familia: 'neutro',
    ambito: 'ambos'
  }
};

export const CHROME = {
  papel: '#EFEFE9',
  superficie: '#FFFFFF',
  pizarra: '#1F2328',
  pizarraSuave: '#2B3037',
  tinta: '#14161A',
  tintaMedia: '#4A5057',
  tintaTenue: '#7C8288',
  linea: '#DCDCD3',
  lineaFuerte: '#C3C3B8'
} as const;

export const VOTO_COLORES = {
  si: '#2E7D5B',
  no: '#B23A2E',
  abstencion: '#B8912E',
  no_vota: '#8E9299',
  ausente: '#C4C8CC'
} as const;

export const SEPARACION_MINIMA_L = 22;

export function validarPaleta(): string[] {
  const conflictos: string[] = [];
  const lista = Object.values(PARTIDOS);
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i];
      const b = lista[j];
      if (a.familia !== b.familia) continue;
      if (a.familia === 'neutro') continue;
      const delta = Math.abs(a.luminosidad - b.luminosidad);
      if (delta < SEPARACION_MINIMA_L) {
        conflictos.push(`${a.siglas} vs ${b.siglas}: ΔL ${delta} < ${SEPARACION_MINIMA_L}`);
      }
    }
  }
  return conflictos;
}

export function getPartido(slug: string): Partido {
  return PARTIDOS[slug] ?? PARTIDOS.sinGrupo;
}

export function partidosPorAmbito(ambito: Exclude<Ambito, 'ambos'>): Partido[] {
  return Object.values(PARTIDOS).filter(p => p.ambito === ambito || p.ambito === 'ambos');
}

export function esGrupoMenor(escanos: number, total: number): boolean {
  return escanos / total < 0.02;
}

export function colorParaEscanos(slug: string, escanos: number, total: number): string {
  if (esGrupoMenor(escanos, total)) return PARTIDOS.sinGrupo.color;
  return getPartido(slug).color;
}
