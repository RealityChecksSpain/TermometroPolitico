export type EjeId = 'izq_der' | 'con_pro' | 'territorial';

export const EJES: EjeId[] = ['izq_der', 'con_pro', 'territorial'];

export const NOMBRE_EJE: Record<EjeId, string> = {
  izq_der: 'Izquierda - Derecha',
  con_pro: 'Conservador - Progresista',
  territorial: 'Centralista - Descentralizador'
};

export const POLOS: Record<EjeId, [string, string]> = {
  izq_der: ['izquierda', 'derecha'],
  con_pro: ['conservador', 'progresista'],
  territorial: ['centralista', 'descentralizador']
};

export interface FuenteExterna {
  id: string;
  nombre: string;
  institucion: string;
  tipo: 'encuesta_expertos' | 'encuesta_ciudadana' | 'analisis_programas' | 'codificacion_documental';
  url: string;
  licencia: string;
  cita: string;
}

export const FUENTES: Record<string, FuenteExterna> = {
  ches: {
    id: 'ches',
    nombre: 'Chapel Hill Expert Survey',
    institucion: 'University of North Carolina at Chapel Hill',
    tipo: 'encuesta_expertos',
    url: 'https://www.chesdata.eu',
    licencia: 'Uso academico y no comercial, con cita obligatoria',
    cita: 'Jolly, S. et al. Chapel Hill Expert Survey. chesdata.eu'
  },
  vparty: {
    id: 'vparty',
    nombre: 'V-Party (Varieties of Party Identity and Organization)',
    institucion: 'V-Dem Institute, University of Gothenburg',
    tipo: 'encuesta_expertos',
    url: 'https://www.v-dem.net/data/v-party-dataset/',
    licencia: 'Acceso abierto con cita obligatoria',
    cita: 'Lindberg, S. I. et al. Varieties of Party Identity and Organization (V-Party). V-Dem Institute'
  },
  marpor: {
    id: 'marpor',
    nombre: 'Manifesto Project (MARPOR)',
    institucion: 'WZB Berlin Social Science Center / IfDem Gottingen',
    tipo: 'analisis_programas',
    url: 'https://manifesto-project.wzb.eu',
    licencia: 'Registro previo, uso academico y no comercial',
    cita: 'Lehmann, P. et al. Manifesto Project Dataset. WZB Berlin Social Science Center'
  }
};

export interface ColumnaMedida {
  nombre: string;
  orientacion: 1 | -1;
}

export interface Medida {
  columnas: ColumnaMedida[];
  escalaMin: number;
  escalaMax: number;
  minimoPresentes: number;
}

export interface EsquemaFuente {
  fuente: string;
  pais: string[];
  nombre: string[];
  nombreCorto: string[];
  anio: string[];
  idCompartido: string[];
  medidas: Partial<Record<EjeId, Medida>>;
}

export const ESQUEMAS: Record<string, EsquemaFuente> = {
  ches: {
    fuente: 'ches',
    pais: ['country_name', 'countryname', 'cname', 'country'],
    nombre: ['party_name_english', 'party_name', 'partyname', 'party'],
    nombreCorto: ['party', 'party_abb', 'party_abbrev'],
    anio: ['year', 'survey_year'],
    idCompartido: ['pf_party_id', 'party_id', 'parlgov_id', 'cmp_id'],
    medidas: {
      izq_der: {
        columnas: [{ nombre: 'lrecon', orientacion: 1 }],
        escalaMin: 0,
        escalaMax: 10,
        minimoPresentes: 1
      },
      con_pro: {
        columnas: [{ nombre: 'galtan', orientacion: -1 }],
        escalaMin: 0,
        escalaMax: 10,
        minimoPresentes: 1
      },
      territorial: {
        columnas: [{ nombre: 'regions', orientacion: -1 }],
        escalaMin: 0,
        escalaMax: 10,
        minimoPresentes: 1
      }
    }
  },
  vparty: {
    fuente: 'vparty',
    pais: ['country_name', 'country_text_id'],
    nombre: ['v2paenname', 'pname', 'v2painname'],
    nombreCorto: ['v2pashname', 'v2paenname'],
    anio: ['year', 'v2paelection_year', 'historical_date'],
    idCompartido: ['pf_party_id', 'v2paid', 'party_id'],
    medidas: {
      izq_der: {
        columnas: [{ nombre: 'v2pariglef_osp', orientacion: 1 }],
        escalaMin: 0,
        escalaMax: 6,
        minimoPresentes: 1
      },
      con_pro: {
        columnas: [
          { nombre: 'v2paimmig_osp', orientacion: 1 },
          { nombre: 'v2pagender_osp', orientacion: 1 },
          { nombre: 'v2parelig_osp', orientacion: 1 },
          { nombre: 'v2paminor_osp', orientacion: 1 },
          { nombre: 'v2paculsup_osp', orientacion: 1 }
        ],
        escalaMin: 0,
        escalaMax: 4,
        minimoPresentes: 3
      }
    }
  },
  marpor: {
    fuente: 'marpor',
    pais: ['countryname', 'country_name'],
    nombre: ['partyname', 'party_name'],
    nombreCorto: ['partyabbrev', 'abbrev', 'party'],
    anio: ['edate', 'date', 'year'],
    idCompartido: ['pf_party_id', 'party', 'party_id'],
    medidas: {
      izq_der: {
        columnas: [{ nombre: 'rile', orientacion: 1 }],
        escalaMin: -100,
        escalaMax: 100,
        minimoPresentes: 1
      }
    }
  }
};

export function normalizarTexto(v: string): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function primeraColumna(cabeceras: string[], candidatos: string[]): string | null {
  const indice = new Map(cabeceras.map(c => [c.trim().toLowerCase(), c]));
  for (const c of candidatos) {
    const encontrada = indice.get(c.toLowerCase());
    if (encontrada) return encontrada;
  }
  return null;
}

export function anioDe(valor: string): number | null {
  const m = String(valor ?? '').match(/(1[6-9]\d{2}|20\d{2}|21\d{2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function normalizarA10(bruto: number, min: number, max: number, orientacion: 1 | -1): number {
  const t = (bruto - min) / (max - min);
  return orientacion === 1 ? t * 10 : 10 - t * 10;
}