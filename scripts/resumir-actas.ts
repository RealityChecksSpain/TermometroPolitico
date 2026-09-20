import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');

const VERSION = process.env.VERSION_ACTA ?? 'acta-v3-2026-09';
const MAX_FRASE = 75;
const MIN_TITULO = 30;
const LIMITE = (() => {
  const i = process.argv.indexOf('--limite');
  if (i < 0) return null;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

const ESQUEMA = {
  type: 'object',
  properties: {
    frase_corta: { type: 'string' },
    resumen: { type: 'string' },
    suficiente_informacion: { type: 'boolean' }
  },
  required: ['frase_corta', 'resumen', 'suficiente_informacion']
};

const MULETILLA = /^\s*(?:est[ae]\s+(?:propuesta|norma|ley|iniciativa|proposici[óo]n|proyecto|moci[óo]n)|el\s+texto|la\s+iniciativa|la\s+presente|la\s+votaci[óo]n)\b/i;
const ARRANQUE_PROHIBIDO = /^(la\s+norma|la\s+ley|se\s+regula|regula|establece|aprueba|modifica|insta|votaci[óo]n\s+de|debate\s+sobre)\b/i;
const PROCEDIMENTAL = /^\s*(?:se\s+(?:vota|somete|debate|presenta|aprueba|tramita)|la\s+votaci[óo]n|debate\s+sobre|el\s+pleno\s+vota|el\s+grupo\s+parlamentario|los\s+grupos\s+parlamentarios|el\s+congreso\s+vota)\b/i;
const VOZ_DE_PARTE = /\b(?:el\s+gobierno|el\s+ejecutivo|la\s+administraci[óo]n)\s+(?:debe|deber[áa]n?|tiene\s+que|ha\s+de|tendr[áa]\s+que)\b/i;

function primeraFrase(t: string): string {
  return t.split(/(?<=\.)\s+/)[0] ?? t;
}

function cifrasNuevas(texto: unknown, titulo: string): string[] {
  const enTitulo = new Set(String(titulo ?? '').match(/\d+/g) ?? []);
  const enTexto = String(texto ?? '').match(/\d+/g) ?? [];
  return enTexto.filter(n => !enTitulo.has(n));
}

function prompt(n: any) {
  const titulo = String(n.titular ?? '').replace(/\s+/g, ' ').trim();
  return `Eres un documentalista parlamentario. Del Congreso de los Diputados solo se publica en datos abiertos el TITULO OFICIAL de esta votación: no hay articulado. Tu tarea es hacer legible ese título, no inventar su contenido.

TITULO OFICIAL COMPLETO:
---
${titulo}
---

REGLAS ESTRICTAS:
- Usa SOLO lo que dice el título. No tienes el texto de la norma. Si el título no lo dice, no lo digas.
- Prohibido inventar cifras, plazos, artículos, importes, porcentajes o FECHAS. Solo puedes escribir un número si aparece tal cual en el título de arriba. Si el título no trae la fecha de firma, no la pongas: se descarta el texto entero.
- Prohibido valorar: nada de "necesaria", "polémica", "beneficia", "perjudica", "mejora", "ataca".
- Prohibido atribuir intenciones: nada de "busca", "pretende", "persigue", "tiene como objetivo", "con el fin de".
- No adoptes la voz de quien firma. Una moción o una proposición no de ley PIDE algo, no lo ordena ni lo consigue: escribe "Pide al Gobierno que...", "Reclama...", "Propone...", y NUNCA "El Gobierno debe...", "El Gobierno tiene que..." ni "El Gobierno debe informar...". Quien lea la ficha tiene que entender que es una petición de un grupo, no una obligación ya existente.
- No copies los adjetivos de parte que traiga el título ("insostenible", "infierno fiscal", "criminal", "caos", "fracaso"). Di el asunto sin el adjetivo: "la situación del Gobierno", no "la insostenible situación del Gobierno".
- Si el título nombra un colectivo, una enfermedad, un territorio, un sector o una ley concreta, NÓMBRALO.
- Español de España, frases cortas, sin jerga jurídica.
- Cada frase termina en punto. No dejes ninguna frase a medias.

CAMPOS:
- frase_corta: UNA frase COMPLETA de entre 30 y ${MAX_FRASE} caracteres que diga de qué va el asunto, entendible sin haber leído el título. Empieza directo por el contenido. PROHIBIDO empezar por "La norma", "El texto", "Esta moción", "Votación de", "Debate sobre", "regula", "establece", "insta". PROHIBIDO cortarla con puntos suspensivos.
- resumen: 2 o 3 frases. La PRIMERA frase dice QUE PIDE O QUE CAMBIA el texto, con su asunto concreto, y tiene que entenderse sola porque es la única que se lee en el listado. PROHIBIDO que la primera frase empiece por "Se vota", "Se somete a votación", "Se debate", "La votación", "El texto", "La presente", "El Grupo Parlamentario" o cualquier fórmula sobre el trámite. Quién lo firma y por qué vía se tramita van en la SEGUNDA frase, nunca en la primera, y solo si aportan algo.

EJEMPLO DE LO QUE NO QUIERO:
"Se somete a votación una moción derivada de una interpelación urgente del Grupo Parlamentario Popular. El asunto trata sobre la financiación de la comunidad autónoma de Galicia."
La primera frase no dice nada: quien solo lea esa línea no sabe de qué va.

EJEMPLO DE LO QUE SI QUIERO:
"Reclama al Gobierno una revisión del modelo de financiación autonómica de Galicia. Lo pide el Grupo Mixto mediante una moción, que no obliga al Gobierno."

- suficiente_informacion: false si el título es tan vago o tan administrativo que no permite decir de qué va sin inventar.`;
}

function validarFrase(frase: unknown, titulo: string): { texto: string | null; cifras: string[] } {
  const t = String(frase ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (!t) return { texto: null, cifras: [] };
  if (t.length < 12) return { texto: null, cifras: [] };
  if (t.length > 180) return { texto: null, cifras: [] };
  if (t.includes('…') || t.endsWith('...')) return { texto: null, cifras: [] };
  if (MULETILLA.test(t)) return { texto: null, cifras: [] };
  if (ARRANQUE_PROHIBIDO.test(t)) return { texto: null, cifras: [] };
  const cifras = cifrasNuevas(t, titulo);
  if (cifras.length > 0) return { texto: null, cifras };
  return { texto: t, cifras: [] };
}

function validarResumen(texto: unknown, titulo: string): { texto: string | null; procedimental: boolean; cifras: string[]; vozDeParte?: boolean } {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 40) return { texto: null, procedimental: false, cifras: [] };
  if (MULETILLA.test(t)) return { texto: null, procedimental: false, cifras: [] };
  if (PROCEDIMENTAL.test(primeraFrase(t))) return { texto: null, procedimental: true, cifras: [] };
  if (VOZ_DE_PARTE.test(t)) return { texto: null, procedimental: false, cifras: [], vozDeParte: true } as any;
  const cifras = cifrasNuevas(t, titulo);
  if (cifras.length > 0) return { texto: null, procedimental: false, cifras };
  return { texto: t, procedimental: false, cifras: [] };
}

const yaHechas = await traerTodo<any>((a, b) =>
  db().from('resumen_acta').select('clave_norma').eq('version_prompt', VERSION).order('clave_norma').range(a, b));
const hechas = new Set(yaHechas.map((r: any) => r.clave_norma));

const todas = await traerTodo<any>((a, b) =>
  db().from('mv_normas').select('clave_norma, titular').order('clave_norma').range(a, b));

const conResumenPropio = new Set((await traerTodo<any>((a, b) =>
  db().from('v_normas_completas')
    .select('clave_norma, frase_corta, resumen')
    .not('frase_corta', 'is', null)
    .order('clave_norma').range(a, b))).map((n: any) => n.clave_norma));

const yaEnActa = new Set((await traerTodo<any>((a, b) =>
  db().from('resumen_acta').select('clave_norma').order('clave_norma').range(a, b))).map((r: any) => r.clave_norma));

const sinNada = todas.filter((n: any) => !conResumenPropio.has(n.clave_norma) || yaEnActa.has(n.clave_norma));
const cortas = sinNada.filter((n: any) => String(n.titular ?? '').trim().length < MIN_TITULO);
const utiles = sinNada.filter((n: any) => String(n.titular ?? '').trim().length >= MIN_TITULO);
const todasPendientes = utiles.filter((n: any) => !hechas.has(n.clave_norma));
const pendientes = LIMITE ? todasPendientes.slice(0, LIMITE) : todasPendientes;

console.log(`\nModelo:      ${modeloActivo()}`);
console.log(`Version:     ${VERSION}`);
console.log(`Normas totales:            ${todas.length}`);
console.log(`Sin texto propio:          ${sinNada.length}`);
console.log(`Titulo demasiado corto:    ${cortas.length}  (menos de ${MIN_TITULO} caracteres, no se piden)`);
console.log(`Ya hechas en esta version: ${hechas.size}`);
console.log(`Pendientes:  ${todasPendientes.length}${LIMITE ? `  (se procesan ${pendientes.length} por --limite)` : ''}`);

if (!pendientes.length) {
  console.log('\nNo hay nada que hacer.\n');
  process.exit(0);
}

let insuficientes = 0;
let errorEscritura = 0;
let fraseRechazada = 0;
let resumenRechazado = 0;
let resumenProcedimental = 0;
let cifraInventada = 0;
let vozDeParte = 0;
const errores = new Map<string, number>();

const progreso = await procesarLote(
  pendientes,
  async (n: any, cadencia: Cadencia) => {
    const r = await preguntar<any>(prompt(n), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      const e = r.error ?? 'sin detalle';
      errores.set(e, (errores.get(e) ?? 0) + 1);
      return null;
    }
    if (!r.datos.suficiente_informacion) { insuficientes++; return null; }

    const titulo = String(n.titular ?? '');
    const juicioFrase = validarFrase(r.datos.frase_corta, titulo);
    const juicio = validarResumen(r.datos.resumen, titulo);
    const frase = juicioFrase.texto;
    if (!frase) fraseRechazada++;
    if (!juicio.texto) resumenRechazado++;
    if (juicio.procedimental) resumenProcedimental++;
    if (juicio.vozDeParte) vozDeParte++;
    if (juicioFrase.cifras.length > 0 || juicio.cifras.length > 0) {
      cifraInventada++;
      const vistas = [...juicioFrase.cifras, ...juicio.cifras].join(', ');
      console.log(`       cifra que no esta en el titulo (${vistas.slice(0, 40)}): ${titulo.slice(0, 54)}`);
    }
    if (!frase && !juicio.texto) return null;

    const { error } = await db().from('resumen_acta').upsert({
      clave_norma: n.clave_norma,
      version_prompt: VERSION,
      frase_corta: frase,
      resumen: juicio.texto,
      acciones: [],
      modelo: r.modelo ?? modeloActivo()
    }, { onConflict: 'clave_norma,version_prompt' });

    if (error) { errorEscritura++; return null; }
    return true;
  },
  {
    alProgreso: (i: number, total: number, n: any, ok: boolean) => {
      if (i % 25 === 0 || !ok) {
        console.log(`  [${String(i).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${String(n.titular ?? '').slice(0, 62)}`);
      }
    }
  }
);

const fallosModelo = Math.max(0, progreso.fallidos - insuficientes - errorEscritura);

console.log('\nRESULTADO');
console.log(`  pedidas:             ${pendientes.length}`);
console.log(`  guardadas:           ${progreso.procesados}`);
console.log(`  titulo insuficiente: ${insuficientes}`);
console.log(`  fallidas modelo:     ${fallosModelo}`);
console.log(`  fallidas al guardar: ${errorEscritura}`);
console.log(`  omitidas:            ${progreso.omitidos}`);

const cuadra = progreso.procesados + insuficientes + fallosModelo + errorEscritura + progreso.omitidos;
if (cuadra !== pendientes.length) {
  console.log(`\n  AVISO: la suma da ${cuadra} y se pidieron ${pendientes.length}.`);
}

console.log('\nCALIDAD');
console.log(`  frase_corta rechazada:            ${fraseRechazada}`);
console.log(`  resumen rechazado:                ${resumenRechazado}`);
console.log(`    de ellos, por empezar por el tramite en vez de por el asunto: ${resumenProcedimental}`);
console.log(`    de ellos, por hablar como si el Gobierno ya estuviera obligado: ${vozDeParte}`);
console.log(`  descartados por traer una cifra o fecha que no esta en el titulo: ${cifraInventada}`);

if (errores.size > 0) {
  console.log('\nERRORES DEL MODELO');
  for (const [e, n] of errores) console.log(`  ${String(n).padStart(4)}  ${e.slice(0, 90)}`);
}

if (progreso.cuotaAgotada) {
  console.log('\n  Se ha agotado la cuota diaria. Vuelve a lanzarlo manana: retoma donde lo dejo.');
}

console.log('\nEstas normas no llevan acciones: el titulo oficial no dice en que direccion empuja el texto,');
console.log('y un chip inventado vale menos que ninguno. Las acciones siguen saliendo solo de leyes codificadas.');

if (LIMITE) {
  console.log(`\nEsto era una muestra de ${LIMITE}. Lee esas frases antes de lanzar las ${todasPendientes.length - pendientes.length} que quedan.`);
}

console.log('');

export {};