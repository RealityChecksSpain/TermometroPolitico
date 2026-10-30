import { getDocumentProxy } from 'unpdf';

export const BASE_AND = 'https://www.parlamentodeandalucia.es';
export const WEB_AND = `${BASE_AND}/webdinamica/portal-web-parlamento`;
export const UA_AND = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 LenteDemocratica';

export const SIGLAS_GRUPO: [RegExp, string][] = [
  [/popular/i, 'PP'],
  [/socialista|psoe/i, 'PSOE-A'],
  [/vox/i, 'VOX'],
  [/adelante/i, 'ADELANTE ANDALUCÍA'],
  [/por andaluc/i, 'POR ANDALUCÍA'],
  [/mixto/i, 'MIXTO']
];

export const SLUG_PARTIDO: Record<string, string> = {
  PP: 'pp',
  'PSOE-A': 'psoe',
  VOX: 'vox',
  'ADELANTE ANDALUCÍA': 'adelante-andalucia',
  'POR ANDALUCÍA': 'por-andalucia'
};

export const CODIGO_GRUPO: Record<string, string> = {
  GPP: 'PP',
  GPS: 'PSOE-A',
  GPVA: 'VOX',
  GPAA: 'ADELANTE ANDALUCÍA',
  GPPorA: 'POR ANDALUCÍA'
};

export function siglasDeGrupo(grupo: string | null | undefined): string | null {
  if (!grupo) return null;
  for (const [re, s] of SIGLAS_GRUPO) if (re.test(grupo)) {
    if (s === 'MIXTO' && /adelante/i.test(grupo)) return 'ADELANTE ANDALUCÍA';
    return s;
  }
  return null;
}

export function llano(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bfdez\b\.?/g, 'fernandez')
    .replace(/\bm[ªa]\b\.?/g, 'maria')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nombreDeListado(apellidosNombre: string): string {
  const [apellidos, nombre] = apellidosNombre.split(',').map(t => t.trim());
  return nombre ? `${nombre} ${apellidos}` : apellidosNombre.trim();
}

export function htmlTexto(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m)
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const ENTIDADES: Record<string, string> = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ',
  uuml: 'ü', Uuml: 'Ü', ordf: 'ª', ordm: 'º', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»'
};

export async function pedir(url: string, intentos = 3): Promise<Response> {
  let ultimo: unknown = null;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA_AND }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return r;
      ultimo = new Error(`HTTP ${r.status} en ${url}`);
    } catch (e) {
      ultimo = e;
    }
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

export async function pedirHtml(url: string): Promise<string> {
  const r = await pedir(url);
  const buf = Buffer.from(await r.arrayBuffer());
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

export async function lineasPdf(buf: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(buf);
  const salida: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const contenido = await pagina.getTextContent();
    const filas = new Map<number, { x: number; fin: number; t: string }[]>();
    for (const it of contenido.items as any[]) {
      const t = String(it.str ?? '');
      if (!t.trim()) continue;
      const x = Number(it.transform?.[4] ?? 0);
      const y = Math.round(Number(it.transform?.[5] ?? 0));
      const fin = x + Number(it.width ?? t.length * 4);
      const clave = [...filas.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      const fila = filas.get(clave) ?? [];
      fila.push({ x, fin, t });
      filas.set(clave, fila);
    }
    const ys = [...filas.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const fila = filas.get(y)!.sort((a, b) => a.x - b.x);
      let linea = '';
      let finPrevio = -Infinity;
      for (const it of fila) {
        const hueco = it.x - finPrevio;
        if (linea) linea += hueco > 12 ? '    ' : hueco > 1.5 ? ' ' : '';
        linea += it.t;
        finPrevio = it.fin;
      }
      salida.push(linea.replace(/[ \t]+$/g, ''));
    }
    salida.push('\f');
  }
  return salida;
}

export function numeroEs(v: string | null | undefined): number | null {
  if (v == null) return null;
  const t = String(v).replace(/[€\s]/g, '').replace(/[’']/g, ',');
  if (!/\d/.test(t)) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export interface DiputadoListado { codmie: number; nombre: string; grupoCodigo: string | null; renuncia: boolean }

export function leerListadoDiputados(html: string, legislatura: number): DiputadoListado[] {
  const vistos = new Map<number, DiputadoListado>();
  const corte = html.search(/Listado de renuncias/i);
  const re = new RegExp(`codmie=(\\d+)&(?:amp;)?nlegis=${legislatura}[^"]*"[^>]*>([\\s\\S]*?)</a>`, 'gi');
  for (const m of html.matchAll(re)) {
    const codmie = Number(m[1]);
    const bloque = html.slice(m.index ?? 0, (m.index ?? 0) + 900);
    const texto = htmlTexto(m[2]).join(' ').replace(/^Fotograf[ií]a( de)?/i, '').trim();
    const grupo = bloque.match(/[([]\s*(GP[A-Za-z]+)\s*[)\]]/)?.[1] ?? null;
    const previo = vistos.get(codmie);
    const nombre = texto && /,/.test(texto) ? texto : previo?.nombre ?? texto;
    vistos.set(codmie, {
      codmie,
      nombre,
      grupoCodigo: grupo ?? previo?.grupoCodigo ?? null,
      renuncia: corte >= 0 && (m.index ?? 0) > corte
    });
  }
  return [...vistos.values()].filter(d => d.nombre);
}

export interface FichaAnd {
  codmie: number;
  nombre_completo: string | null;
  grupo: string | null;
  circunscripcion: string | null;
  escano: number | null;
}

export function leerFicha(html: string, codmie: number): FichaAnd {
  const L = htmlTexto(html);
  const i = L.findIndex(l => /^Circunscripci[oó]n:?$/i.test(l));
  const grupo = i > 0 ? L[i - 1] : L.find(l => /^G\.?P\.? /i.test(l)) ?? null;
  const nombre = i > 1 ? L[i - 2] : null;
  const circ = i >= 0 ? L[i + 1] : null;
  const esc = L.find(l => /^Escaño:\s*\d+/i.test(l));
  return {
    codmie,
    nombre_completo: nombre && !/^G\.?P/i.test(nombre) ? nombre : null,
    grupo: grupo && /^G\.?P/i.test(grupo) ? grupo : null,
    circunscripcion: circ,
    escano: esc ? Number(esc.replace(/\D+/g, '')) : null
  };
}

export type SentidoVoto = 'si' | 'no' | 'abstencion' | 'blanco' | 'ausente';

export interface VotoNominal { escano: number; nombre: string; grupo: string; voto: SentidoVoto; delegado: boolean }

export interface VotacionAnd {
  sesion: number | null;
  numero: number;
  protocolo: number | null;
  fecha: string | null;
  titulo_general: string | null;
  titulo_particular: string | null;
  expediente: string | null;
  tipo_iniciativa: string | null;
  totales: Record<string, Record<string, number>>;
  votos: VotoNominal[];
}

const SENTIDO: Record<string, SentidoVoto> = {
  'SÍ': 'si', SI: 'si', NO: 'no', ABSTENCIONES: 'abstencion', 'ABSTENCIÓN': 'abstencion',
  BLANCOS: 'blanco', BLANCO: 'blanco', AUSENTES: 'ausente', AUSENTE: 'ausente'
};

const FILA_TOTALES = /^(PRESENTES|SI|NO|ABSTENCIONES|BLANCOS|VOTOS DELEGADOS|TOTAL SI|TOTAL NO|TOTAL ABSTENCIONES|TOTAL BLANCOS|DIPUTADOS AUSENTES|TOTAL DIPUTADOS)\s+((?:\d{1,3}\s+)*\d{1,3})\s*$/;

export function tipoDeExpediente(exp: string | null): string | null {
  const m = exp?.match(/\/([A-Z]+)-/);
  return m ? m[1] : null;
}

export function leerVotaciones(lineas: string[]): VotacionAnd[] {
  const salida: VotacionAnd[] = [];
  let actual: VotacionAnd | null = null;
  let grupo = '';
  let sentido: SentidoVoto | null = null;
  let modo: 'nada' | 'general' | 'particular' | 'totales' | 'nominal' = 'nada';
  let cabecera: string[] = [];
  let bloqueTotal: string | null = null;
  let generalPendiente: string[] = [];

  const cerrar = () => {
    if (actual) salida.push(actual);
    actual = null;
  };

  for (const bruta of lineas) {
    const l = bruta.trim();
    if (!l || l === '\f') continue;
    if (/^T[ÍI]TULO GENERAL DEL DEBATE/i.test(l)) {
      cerrar();
      modo = 'general';
      generalPendiente = [];
      continue;
    }
    if (/^PARLAMENTO DE ANDALUC[ÍI]A/i.test(l) || /^Nota aclaratoria|^Advertencia|^Esta informaci|^electr[oó]nico|^Parlamento de Andaluc|^En las p[aá]ginas|^debido a la Delegaci|^votaciones en Pleno|^puede consultarse|^que delega|^entre par[eé]ntesis|^votaci[oó]n con un/i.test(l)) continue;
    if (modo === 'general') {
      const f = l.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
      if (f) {
        const titulo = generalPendiente.join(' ').replace(/\s+/g, ' ').trim();
        const exp = titulo.match(/^(\d{1,2}-\d{2}\/[A-Z]+-\d+)/)?.[1] ?? null;
        actual = {
          sesion: null, numero: 0, protocolo: null,
          fecha: `${f[1].slice(6)}-${f[1].slice(3, 5)}-${f[1].slice(0, 2)}T${f[2]}`,
          titulo_general: titulo || null, titulo_particular: null,
          expediente: exp, tipo_iniciativa: tipoDeExpediente(exp),
          totales: {}, votos: []
        };
        modo = 'particular';
        continue;
      }
      generalPendiente.push(l);
      continue;
    }
    if (!actual) continue;
    const num = l.match(/^VOTACI[ÓO]N N[ºo°]\s*(\d+)/i);
    if (num) { actual.numero = Number(num[1]); continue; }
    const pro = l.match(/^PROTOCOLO\s+(\d+)/i);
    if (pro) { actual.protocolo = Number(pro[1]); continue; }
    const ses = l.match(/^SESI[ÓO]N\s+(\d+)/i);
    if (ses) { actual.sesion = Number(ses[1]); continue; }
    if (/^T[ÍI]TULO PARTICULAR DEL DEBATE:?/i.test(l)) {
      const resto = l.replace(/^T[ÍI]TULO PARTICULAR DEL DEBATE:?/i, '').trim();
      actual.titulo_particular = resto || null;
      modo = 'particular';
      continue;
    }
    if (/^PRESIDE LA VOTACI[ÓO]N/i.test(l)) { modo = 'particular'; continue; }
    if (/^TOTAL\s+PP\b/.test(l)) {
      cabecera = l.replace(/_$/, '').split(/\s+/).slice(1);
      modo = 'totales';
      continue;
    }
    if (modo === 'particular' && !/^G\.\s?P\./.test(l)) {
      actual.titulo_particular = [actual.titulo_particular, l].filter(Boolean).join(' ');
      continue;
    }
    if (modo === 'totales') {
      const t = l.match(FILA_TOTALES);
      if (t) {
        const nums = t[2].split(/\s+/).map(Number);
        const nombre = t[1] === 'SI' || t[1] === 'NO' || t[1] === 'ABSTENCIONES' || t[1] === 'BLANCOS'
          ? (bloqueTotal ? `DELEGADOS ${t[1]}` : t[1])
          : t[1];
        if (t[1] === 'VOTOS DELEGADOS') bloqueTotal = 'delegados';
        if (t[1].startsWith('TOTAL ')) bloqueTotal = null;
        actual.totales[nombre] = Object.fromEntries(['TOTAL', ...cabecera].map((c, k) => [c, nums[k] ?? 0]));
        continue;
      }
    }
    if (/^G\.\s?P\./i.test(l)) {
      grupo = l.replace(/\s+/g, ' ');
      sentido = null;
      modo = 'nominal';
      bloqueTotal = null;
      continue;
    }
    const s = l.match(/^\*{3}\s*(.+?)\s*\*{3}$/);
    if (s) { sentido = SENTIDO[s[1].toUpperCase()] ?? null; continue; }
    if (modo === 'nominal' && sentido) {
      if (/^\(\s*\*\s*\)/.test(l) && actual.votos.length) actual.votos[actual.votos.length - 1].delegado = true;
      const fila = l.replace(/^\(\s*\*\s*\)\s*/, '').replace(/\)(\d{3}\s)/g, ') $1');
      for (const m of fila.matchAll(/(\d{3})\s+([^\d]+?)(?=\s+\d{3}\s|\s*$)/g)) {
        const crudo = m[2].trim();
        const delegado = /\(\s*\*\s*\)/.test(crudo);
        const indicado = crudo.match(/\((S[ÍI]|NO|ABST[A-ZÓ]*)\)/i)?.[1];
        let voto: SentidoVoto = sentido;
        if (sentido === 'ausente' && indicado) voto = /^S/i.test(indicado) ? 'si' : /^NO/i.test(indicado) ? 'no' : 'abstencion';
        actual.votos.push({
          escano: Number(m[1]),
          nombre: crudo.replace(/\(.*?\)/g, '').trim(),
          grupo,
          voto,
          delegado: delegado || (sentido === 'ausente' && Boolean(indicado))
        });
      }
    }
  }
  cerrar();
  return salida.filter(v => v.votos.length > 0 || Object.keys(v.totales).length > 0);
}

export interface InmuebleAnd { clave: string; tipo: string; provincia: string | null; porcentaje: number | null; valor_catastral: number | null; texto: string }

export interface DeclaracionAnd {
  apellidos: string;
  nombre: string;
  circunscripcion: string | null;
  partido_candidatura: string | null;
  motivo: string | null;
  inmuebles: InmuebleAnd[];
  saldo_cuentas: number | null;
  saldo_porcentaje: number | null;
  valores: { entidad: string; valor: number | null }[];
  bienes_otros: { descripcion: string; valor: number | null }[];
  deudas: { descripcion: string; valor: number | null }[];
  cargos_publicos: string[];
  actividades_privadas: string[];
  pagina: number | null;
  legislatura: string | null;
}

const LINEA_INMUEBLE = /^([PNM])\s+([VLOR])\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*€?$/;
const LINEA_INMUEBLE_SIN_VALOR = /^([PNM])\s+([VLOR])\s+(.+?)$/;
const VALOR_FINAL = /^(.+?)\s{2,}(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*€?$/;

function porcentajeDe(t: string): number | null {
  const m = t.match(/\(\s*(\d{1,3}(?:[.,’']\d+)?)\s*%\s*\)/);
  if (!m) return null;
  const v = Number(m[1].replace(/[’']/g, '.').replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : null;
}

export function leerDeclaraciones(lineas: string[]): DeclaracionAnd[] {
  const salida: DeclaracionAnd[] = [];
  let d: DeclaracionAnd | null = null;
  let seccion = '';
  let pagina = 0;
  let esperaNombre = false;
  let esperaCirc = false;
  let legislatura: string | null = null;

  for (let k = 0; k < lineas.length; k++) {
    const bruta = lineas[k];
    if (bruta === '\f') { pagina++; continue; }
    const l = bruta.trim();
    if (!l) continue;
    const leg = l.match(/^PARLAMENTO DE ANDALUC[ÍI]A\.?\s+([XVI]+)\s+LEGISLATURA/i) ?? l.match(/^([XVI]+)\s+LEGISLATURA\b/i);
    if (leg) { legislatura = leg[1].toUpperCase(); continue; }
    if (/^APELLIDOS(,\s*NOMBRE)?\b/i.test(l)) {
      if (d) salida.push(d);
      d = {
        apellidos: '', nombre: '', circunscripcion: null, partido_candidatura: null, motivo: null,
        inmuebles: [], saldo_cuentas: null, saldo_porcentaje: null, valores: [], bienes_otros: [], deudas: [],
        cargos_publicos: [], actividades_privadas: [], pagina: pagina + 1, legislatura
      };
      seccion = '';
      const [persona, circ] = l.split(/\s*CIRCUNSCRIPCI[ÓO]N:+\s*/i);
      const enLinea = persona.match(/^APELLIDOS,\s*NOMBRE:\s*(.+?),\s*(.+)$/i);
      if (enLinea) { d.apellidos = enLinea[1].trim(); d.nombre = enLinea[2].trim(); esperaNombre = false; }
      if (circ) d.circunscripcion = circ.split(/\s{2,}/)[0].trim();
      else esperaNombre = true;
      continue;
    }
    if (!d) continue;
    if (esperaNombre) {
      const partes = l.split(/\s{3,}/);
      d.apellidos = partes[0].trim();
      d.nombre = (partes[1] ?? '').trim();
      esperaNombre = false;
      continue;
    }
    const circEnLinea = l.match(/^CIRCUNSCRIPCI[ÓO]N:\s*(.+)$/i);
    if (circEnLinea) { d.circunscripcion = circEnLinea[1].trim(); continue; }
    const partEnLinea = l.match(/^PARTIDO, FEDERACI[ÓO]N, COALICI[ÓO]N o AGRUPACI[ÓO]N:\s*(.+)$/i);
    if (partEnLinea) { d.partido_candidatura = partEnLinea[1].trim(); continue; }
    if (/^CIRCUNSCRIPCI[ÓO]N ELECTORAL/i.test(l)) { esperaCirc = true; continue; }
    if (esperaCirc) {
      const partes = l.split(/\s{3,}/);
      d.circunscripcion = partes[0].trim();
      d.partido_candidatura = (partes[1] ?? '').trim() || null;
      esperaCirc = false;
      continue;
    }
    const motivo = l.match(/^MOTIVOS DE LA DECLARACI[ÓO]N\s+(.+)$/i);
    if (motivo) { d.motivo = motivo[1].trim(); continue; }
    if (/^BOPA_\d|^cve:?$|^\d{8}$|^En [A-ZÁÉÍÓÚ][a-záéíóú]+, a \d|Dep[óo]sito Legal|ISSN|Seguro De Verific|^CC[óo]|^Firmado|^El letrado|^Sevilla, \d/i.test(l) || /^(\S)\1(\S)\2(\S)\3/u.test(l) || /Firmado\b|Verificaci[óo]n|Observaciones$|^Fecha elecciones|^REGISTRO DE ACTIVIDADES|^DATOS PERSONALES|^PARLAMENTO DE ANDALUC|^Percibe retribuciones|^Hasta el momento de su elecci|^SOCIALISTA|^MOTIVOS DE LA/i.test(l)) continue;
    if (/BIENES INMUEBLES/i.test(l)) { seccion = 'inmuebles'; continue; }
    if (/CARGOS P[ÚU]BLICOS/i.test(l)) { seccion = 'cargos'; continue; }
    if (/ACTIVIDADES PRIVADAS/i.test(l)) { seccion = 'privadas'; continue; }
    if (/^\d\.\s*DECLARACI[ÓO]N|DECLARACI[ÓO]N DE BIENES E INTERESES|DECLARACI[ÓO]N DE ACTIVIDADES/i.test(l)) { seccion = 'otra'; continue; }
    const saldo = l.match(/SALDO TOTAL DE CUENTAS BANCARIAS(?:\s*\([^)]*\))?\s*:?\s*(\d[\d.]*(?:,\d+)?)\s*(?:euros?|€)?\s*(\([^)]*%[^)]*\))?/i);
    if (saldo) {
      d.saldo_cuentas = numeroEs(saldo[1]);
      d.saldo_porcentaje = saldo[2] ? porcentajeDe(saldo[2]) : null;
      seccion = '';
      continue;
    }
    if (/SALDO TOTAL DE CUENTAS/i.test(l)) { seccion = 'saldo'; continue; }
    if (seccion === 'saldo') {
      const m = l.match(/([\d.]+,\d{2})/);
      if (m) { d.saldo_cuentas = numeroEs(m[1]); d.saldo_porcentaje = porcentajeDe(l); seccion = ''; }
      continue;
    }
    if (/ACCIONES Y PARTICIPACIONES|VALORES MOBILIARIOS/i.test(l)) { seccion = 'valores'; continue; }
    if (/AUTOM[ÓO]VILES, EMBARCACIONES/i.test(l)) { seccion = 'otros'; continue; }
    if (/CR[ÉE]DITOS, PR[ÉE]STAMOS O DEUDAS/i.test(l)) { seccion = 'deudas'; continue; }
    if (/ACTIVIDADES P[ÚU]BLICAS|INGRESOS Y RETRIBUCIONES|OTROS INTERESES|^1\.\d|^2\.\d|^- [A-ZÁÉÍÓÚ]/.test(l)) { seccion = 'otra'; continue; }
    if (/^(ha renunciado|incompatible|Haga constar|renunciado al cargo|si procede|pase a la situaci|equivalente, o a|corresponda|Fecha de|inicio|nombramiento|Cargo desempe|Actividad desempe|Entidad, organismo)/i.test(l)) continue;
    if (/^\(\*|^\(\*\*|^\(\*\*\*|^\(Para determinar|^anualmente|^Impuestos de|^del bien|^NATURALEZA CUYO|^Clave|^Entidad\b|^Descripci[oó]n\b|^Valor \(euros\)|cve:|^P[áa]g\. |BOLET[ÍI]N OFICIAL|^Extraordinario|^wb$|LEGISLATURA|^DECLARACI[ÓO]N DE ACTIVIDADES, BIENES|^PROCLAMADOS|^En cumplimiento|^la presente|^Dep[óo]sito Legal|^BOJA|^N[úu]mero \d+|^p[áa]gina \d+|^https?:/i.test(l)) continue;

    if (seccion === 'inmuebles') {
      const m = l.match(LINEA_INMUEBLE) ?? l.match(LINEA_INMUEBLE_SIN_VALOR);
      if (m) {
        const situacion = m[3].trim();
        d.inmuebles.push({
          clave: m[1],
          tipo: m[2],
          provincia: situacion.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim() || null,
          porcentaje: porcentajeDe(situacion),
          valor_catastral: m[4] ? numeroEs(m[4]) : null,
          texto: l.replace(/\s+/g, ' ')
        });
      }
      continue;
    }
    if (seccion === 'valores' || seccion === 'otros' || seccion === 'deudas') {
      const m = l.match(VALOR_FINAL);
      const fila = m ? { t: m[1].replace(/\s+/g, ' ').trim(), v: numeroEs(m[2]) } : { t: l.replace(/\s+/g, ' '), v: null };
      if (seccion === 'valores') d.valores.push({ entidad: fila.t, valor: fila.v });
      else if (seccion === 'otros') d.bienes_otros.push({ descripcion: fila.t, valor: fila.v });
      else d.deudas.push({ descripcion: fila.t, valor: fila.v });
      continue;
    }
    if (seccion === 'cargos') { d.cargos_publicos.push(l.replace(/\s{2,}/g, ' · ')); continue; }
    if (seccion === 'privadas') { d.actividades_privadas.push(l.replace(/\s{2,}/g, ' · ')); continue; }
  }
  if (d) salida.push(d);
  return salida.filter(x => x.apellidos);
}

export function resumenInmuebles(inm: InmuebleAnd[]) {
  const parte = (i: InmuebleAnd) => (i.porcentaje ?? 100) / 100;
  const de = (t: string) => inm.filter(i => i.tipo === t);
  const suma = (l: InmuebleAnd[]) => Math.round(l.reduce((s, i) => s + parte(i), 0) * 10) / 10;
  const valor = inm.reduce((s, i) => s + (i.valor_catastral ?? 0) * parte(i), 0);
  return {
    n_inmuebles: inm.length,
    n_inmuebles_equivalentes: suma(inm),
    n_viviendas: de('V').length,
    n_viviendas_equivalentes: suma(de('V')),
    n_locales: de('L').length,
    n_otros_urbanos: de('O').length,
    n_rusticos: de('R').length,
    valor_catastral_propio: Math.round(valor * 100) / 100
  };
}
