import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';
import { refrescarMetricas } from '../src/lib/metricas';

exigirEnv('GEMINI_API_KEY');

const VERSION = process.env.VERSION_PROMPT ?? 'v5-sujeto-2026-09';
const SOLO_CON_TEXTO = process.env.SOLO_CON_TEXTO !== 'false';
const MAX_CHARS = Number(process.env.MAX_CHARS_PROMPT ?? 60000);
const MIN_CHARS_NORMA = Number(process.env.MIN_CHARS_NORMA ?? 5000);
const LIMITE = (() => {
  const i = process.argv.indexOf('--limite');
  if (i < 0) return null;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

const MAX_FRASE = 75;

const ESQUEMA = {
  type: 'object',
  properties: {
    frase_corta: { type: 'string' },
    resumen: { type: 'string' },
    puntos_clave: { type: 'array', items: { type: 'string' } },
    que_cambia: { type: 'array', items: { type: 'string' } },
    a_quien_afecta: { type: 'string' },
    entrada_en_vigor: { type: 'string' },
    suficiente_informacion: { type: 'boolean' }
  },
  required: ['frase_corta', 'resumen', 'puntos_clave', 'que_cambia', 'a_quien_afecta', 'entrada_en_vigor', 'suficiente_informacion']
};

const ARTICULADO = /\b(?:art[íi]culo\s+(?:único|primero|\d+)|disposición\s+(?:adicional|final|transitoria|derogatoria))\b/i;
const ARTICULO_SUELTO = /\bart[íi]culos?\b/gi;
const DISPOSICION = /\bdisposici[óo]n\s+(?:adicional|final|transitoria|derogatoria)\b/i;
const MULETILLA = /^\s*(?:est[ae]\s+(?:propuesta|norma|ley|iniciativa|proposici[óo]n|proyecto)|el\s+texto|la\s+iniciativa|la\s+presente)\b/i;
const HUECO = /\b(?:xx+|__+|\.\.\.|\[\s*\.{2,}\s*\]|\[[^\]]*rellenar[^\]]*\])\b/i;

function fragmentar(texto: string, tope: number): string {
  const limpio = String(texto ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (limpio.length <= tope) return limpio;

  const marca = limpio.search(ARTICULADO);
  const cuerpo = marca > 0 ? limpio.slice(marca) : limpio;
  if (cuerpo.length <= tope) return cuerpo;

  const presupuesto = Math.floor(tope / 3);
  const cabeza = cuerpo.slice(0, presupuesto);
  const medio = cuerpo.slice(
    Math.floor(cuerpo.length / 2) - Math.floor(presupuesto / 2),
    Math.floor(cuerpo.length / 2) + Math.floor(presupuesto / 2)
  );
  const cola = cuerpo.slice(-presupuesto);

  return [
    cabeza,
    '\n[…fragmento omitido del texto oficial…]\n',
    medio,
    '\n[…fragmento omitido del texto oficial…]\n',
    cola
  ].join('');
}

function esNotaDeTramite(i: any): boolean {
  const chars = Number(i.texto_chars ?? 0);
  if (chars >= MIN_CHARS_NORMA) return false;
  const texto = String(i.texto_extraido ?? '');
  if (DISPOSICION.test(texto)) return false;
  const menciones = (texto.match(ARTICULO_SUELTO) ?? []).length;
  return menciones < 3;
}

function promptConTexto(i: any): { texto: string; recortado: boolean; chars: number } {
  const bruto = String(i.texto_extraido ?? '');
  const fuente = fragmentar(bruto, MAX_CHARS);
  const recortado = fuente.includes('[…fragmento omitido');

  const texto = `Eres documentalista parlamentario. Explicas normas del Congreso de los Diputados a ciudadanos sin formación jurídica.

TITULO OFICIAL: ${i.titulo}
PRESENTADA POR: ${i.autor_texto ?? 'no consta'}
SITUACION: ${i.situacion ?? 'no consta'}

TEXTO OFICIAL PUBLICADO EN EL BOLETIN OFICIAL DE LAS CORTES GENERALES:
---
${fuente}
---
${recortado
  ? 'AVISO: el texto de arriba está recortado y faltan fragmentos marcados. Resume solo lo que puedas leer. Si lo que falta te impide describir la norma, responde suficiente_informacion = false.'
  : 'El texto de arriba está completo.'}

REGLAS ESTRICTAS:
- Usa SOLO el texto de arriba. Si algo no está ahí, no lo digas.
- Prohibido valorar: nada de "necesaria", "polémica", "beneficia", "perjudica", "recorta", "mejora", "ataca".
- Prohibido atribuir intenciones: nada de "busca", "pretende", "persigue", "trata de", "tiene como objetivo", "con el fin de", "el objetivo es". Di lo que la norma HACE, no lo que quiere conseguir.
- Prohibido especular sobre consecuencias políticas, económicas o sociales no escritas en el texto.
- No copies el título literalmente. Pero si la norma trata de un colectivo, una enfermedad, un territorio, un sector o una ley concreta, NÓMBRALO. Quien lea el resumen sin haber visto el título tiene que saber de qué va. Escribir "personas en situación de gran dependencia" cuando la norma es sobre esclerosis lateral amiotrófica es un error.
- Cuando el texto cite artículos o leyes concretas, nómbralos.
- Si el texto trae un hueco sin rellenar (XX, __, puntos suspensivos entre corchetes), no lo copies: escribe "No consta en el texto".
- Español de España, frases cortas, sin jerga jurídica. Si usas un término técnico, explícalo entre paréntesis.
- Cada frase termina en punto. No dejes ninguna frase a medias.

CAMPOS:
- frase_corta: UNA frase COMPLETA de entre 30 y ${MAX_FRASE} caracteres, con sujeto y verbo o como sintagma cerrado. Debe entenderse sola, fuera de contexto, sin haber leído el título. Empieza directo por el contenido: "Cribado neonatal cada dos años", "Las rentas del alquiler se congelan tres años". PROHIBIDO empezar por "La norma", "regula", "establece", "aprueba", "modifica". PROHIBIDO cortarla con puntos suspensivos. Sin jerga. Sin partido autor. Sin adjetivos valorativos.
- resumen: 3 a 5 frases. Qué establece la norma en la práctica. Concreto, no genérico. PROHIBIDO empezar por "Esta propuesta", "Esta norma", "Esta ley", "El texto" o "La iniciativa": arranca por el sujeto de la medida o por el verbo. La PRIMERA frase debe poder leerse sola como resumen de todo.
- puntos_clave: 3 a 5 medidas concretas que introduce, cada una en una frase. Con cifras, plazos o artículos si el texto los da.
- que_cambia: 2 a 4 elementos con el formato "Antes X. Ahora Y." solo cuando el texto lo permita deducir. Lista vacía si no.
- a_quien_afecta: SOLO los colectivos concretos que menciona el texto, separados por comas. Nada de fechas ni de entrada en vigor aquí. Si el texto no nombra ninguno, escribe "El texto no nombra colectivos concretos".
- entrada_en_vigor: lo que diga el texto, o "No consta en el texto".
- suficiente_informacion: false si el texto es ilegible, si no contiene articulado, si es solo una nota de remisión o traslado entre cámaras, o si está tan recortado que no se puede describir la norma.`;

  return { texto, recortado, chars: fuente.length };
}

function limpiarHueco(t: unknown): string | null {
  const s = String(t ?? '').trim();
  if (!s) return null;
  if (HUECO.test(s)) return null;
  if (/^no\s+consta/i.test(s)) return null;
  return s;
}

function validarFrase(frase: unknown): string | null {
  const t = String(frase ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (!t) return null;
  if (t.length < 12) return null;
  if (t.includes('…') || t.endsWith('...')) return null;
  if (MULETILLA.test(t)) return null;
  if (/^(la\s+norma|la\s+ley|se\s+regula|regula|establece|aprueba|modifica)\b/i.test(t)) return null;
  return t.slice(0, 180);
}

const yaHechas = await traerTodo<any>((a, b) =>
  db().from('resumenes_ia').select('iniciativa_id').eq('version_prompt', VERSION).order('iniciativa_id').range(a, b));
const hechas = new Set(yaHechas.map((r: any) => r.iniciativa_id));

const todas = await traerTodo<any>((a, b) => {
  let q = db().from('iniciativas')
    .select('id, titulo, autor_texto, situacion, texto_extraido, texto_chars')
    .order('id').range(a, b);
  if (SOLO_CON_TEXTO) q = q.gt('texto_chars', 400);
  return q;
});

const notas = todas.filter((i: any) => esNotaDeTramite(i));
const conNorma = todas.filter((i: any) => !esNotaDeTramite(i));
const todasPendientes = conNorma.filter((i: any) => !hechas.has(i.id));
const pendientes = LIMITE ? todasPendientes.slice(0, LIMITE) : todasPendientes;

console.log(`\nModelo:      ${modeloActivo()}`);
console.log(`Version:     ${VERSION}`);
console.log(`Tope prompt: ${MAX_CHARS.toLocaleString('es')} caracteres  (MAX_CHARS_PROMPT)`);
console.log(`Con texto:   ${todas.length}`);
console.log(`Descartadas por ser nota de tramite sin articulado: ${notas.length}`);
console.log(`Ya resumidas en esta version: ${hechas.size}`);
console.log(`Pendientes:  ${todasPendientes.length}${LIMITE ? ` (se procesan ${pendientes.length} por --limite)` : ''}`);

if (todasPendientes.length > 0) {
  const media = Math.round(todasPendientes.reduce((a: number, i: any) => a + (i.texto_chars ?? 0), 0) / todasPendientes.length);
  const largas = todasPendientes.filter((i: any) => (i.texto_chars ?? 0) > MAX_CHARS).length;
  console.log(`Tamano medio: ${media.toLocaleString('es')} caracteres`);
  console.log(`Se fragmentaran: ${largas} de ${todasPendientes.length}\n`);
}

if (!pendientes.length) {
  console.log(
    todas.length === 0
      ? 'No hay iniciativas con texto descargado. Ejecuta antes: npm run textos\n'
      : `Nada pendiente: las ${hechas.size} iniciativas con articulado ya tienen resumen ${VERSION}.\n`
  );
  console.log('Comprueba el estado global con: npm run estado:ia\n');
  process.exit(0);
}

let insuficientes = 0;
let fragmentadas = 0;
let fraseRechazada = 0;
let fraseLarga = 0;
let resumenMuletilla = 0;
let vigorDescartada = 0;
let sinPuntos = 0;
let errorEscritura = 0;
const errores = new Map<string, number>();

const progreso = await procesarLote(
  pendientes,
  async (i: any, cadencia: Cadencia) => {
    const { texto, recortado, chars } = promptConTexto(i);
    if (recortado) fragmentadas++;

    const r = await preguntar<any>(texto, cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      const e = r.error ?? 'sin detalle';
      errores.set(e, (errores.get(e) ?? 0) + 1);
      return null;
    }
    if (!r.datos.suficiente_informacion) { insuficientes++; return null; }

    const frase = validarFrase(r.datos.frase_corta);
    if (!frase) fraseRechazada++;
    else if (frase.length > MAX_FRASE) fraseLarga++;

    const resumen = String(r.datos.resumen ?? '').trim();
    if (MULETILLA.test(resumen)) resumenMuletilla++;

    const vigor = limpiarHueco(r.datos.entrada_en_vigor);
    if (!vigor && String(r.datos.entrada_en_vigor ?? '').trim()) vigorDescartada++;

    const puntos = [
      ...(Array.isArray(r.datos.puntos_clave) ? r.datos.puntos_clave : []),
      ...(Array.isArray(r.datos.que_cambia) ? r.datos.que_cambia : []).map((c: string) => `Cambio: ${c}`),
      vigor ? `Entrada en vigor: ${vigor}` : null
    ].filter(p => String(p ?? '').trim().length > 0);
    if (puntos.length === 0) sinPuntos++;

    const afecta = String(r.datos.a_quien_afecta ?? '').replace(/\s*·?\s*Entrada en vigor:.*$/i, '').trim();

    const { error: e } = await db().from('resumenes_ia').upsert({
      iniciativa_id: i.id,
      modelo: r.modelo ?? modeloActivo(),
      version_prompt: VERSION,
      resumen,
      frase_corta: frase,
      puntos_clave: puntos,
      a_quien_afecta: afecta || null,
      tokens_entrada: r.tokensEntrada ?? null,
      tokens_salida: r.tokensSalida ?? null,
      basado_en: 'texto_bocg',
      chars_fuente: chars,
      revisado: false
    }, { onConflict: 'iniciativa_id,version_prompt' });

    if (e) {
      errorEscritura++;
      errores.set(`escritura: ${e.message}`, (errores.get(`escritura: ${e.message}`) ?? 0) + 1);
      return null;
    }
    return true;
  },
  {
    alProgreso: (n, total, i: any, ok) => {
      if (n % 10 === 0 || !ok) {
        console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${String(i.titulo).slice(0, 58)}`);
      }
    }
  }
);

const fallosModelo = Math.max(0, progreso.fallidos - insuficientes - errorEscritura);

console.log('\nRESULTADO');
console.log(`  pedidas:          ${pendientes.length}`);
console.log(`  guardadas:        ${progreso.procesados}`);
console.log(`  sin info suf.:    ${insuficientes}`);
console.log(`  fallidas modelo:  ${fallosModelo}`);
console.log(`  fallidas al guardar: ${errorEscritura}`);
console.log(`  omitidas:         ${progreso.omitidos}`);

const cuadra = progreso.procesados + insuficientes + fallosModelo + errorEscritura + progreso.omitidos;
if (cuadra !== pendientes.length) {
  console.log(`\n  AVISO: la suma da ${cuadra} y se pidieron ${pendientes.length}. Faltan ${pendientes.length - cuadra} sin explicar.`);
}

console.log('\nCALIDAD');
console.log(`  con texto fragmentado:     ${fragmentadas}`);
console.log(`  frase_corta rechazada:     ${fraseRechazada} (se guardan con frase nula; la web cae al titulo oficial)`);
console.log(`  frase_corta de mas de ${MAX_FRASE}:  ${fraseLarga}`);
console.log(`  resumen que empieza por muletilla: ${resumenMuletilla}`);
console.log(`  entrada en vigor con hueco sin rellenar, descartada: ${vigorDescartada}`);
console.log(`  sin puntos clave:          ${sinPuntos}`);

if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 140)}`));
}

if (LIMITE) {
  console.log(`\nEsto era una muestra de ${LIMITE}. Lee esos resumenes antes de lanzar los ${todasPendientes.length - pendientes.length} que quedan.`);
  console.log(`Quedan pendientes: ${todasPendientes.length - progreso.procesados}\n`);
} else {
  await refrescarMetricas();
  console.log('\nMetricas refrescadas.\n');
}

export {};