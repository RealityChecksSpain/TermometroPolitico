import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';
import { refrescarCaches } from '../src/lib/metricas';

exigirEnv('GEMINI_API_KEY');

const CAMARAS: Record<string, { nombre: string; corto: string; Corto: string; boletin: string; gobierno: string; leyes: string[]; version: string }> = {
  'parlamento-andalucia': {
    nombre: 'el Parlamento de Andalucía', corto: 'el Parlamento', Corto: 'El Parlamento',
    boletin: 'BOLETÍN OFICIAL DEL PARLAMENTO DE ANDALUCÍA', gobierno: 'el Consejo de Gobierno',
    leyes: ['PL', 'PPL', 'ILPA', 'DL'], version: 'and-v2-2026-10'
  },
  'asamblea-madrid': {
    nombre: 'la Asamblea de Madrid', corto: 'la Asamblea', Corto: 'La Asamblea',
    boletin: 'BOLETÍN OFICIAL DE LA ASAMBLEA DE MADRID', gobierno: 'el Gobierno de la Comunidad de Madrid',
    leyes: ['PL', 'PROPL'], version: 'mad-v1-2026-10'
  }
};
const CAMARA = process.argv.find(a => a.startsWith('--camara='))?.slice(9) ?? 'parlamento-andalucia';
const O = CAMARAS[CAMARA];
if (!O) throw new Error(`Cámara desconocida: ${CAMARA}`);
const VERSION = process.env.VERSION_PROMPT_PARL ?? O.version;
const MAX_CHARS = Number(process.env.MAX_CHARS_PROMPT ?? 60000);
const MAX_FRASE = 75;
const LIMITE = (() => {
  const i = process.argv.indexOf('--limite');
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
})();

const LEYES = new Set(O.leyes);
const CLASE: Record<string, string> = {
  ley: 'TEXTO DE LA LEY TAL Y COMO LA APROBÓ EL PLENO',
  aprobado: 'TEXTO APROBADO POR EL PLENO',
  presentado: 'TEXTO PRESENTADO (antes de debatirse y de las enmiendas)'
};

const { data: materias } = await db().from('materias').select('id, slug, nombre, descripcion').order('codigo_cap');
const { data: colectivos } = await db().from('colectivos').select('id, slug, nombre, descripcion').order('orden');
const slugMateria = new Set((materias ?? []).map((m: any) => m.slug));
const nombreColectivo = new Map((colectivos ?? []).map((c: any) => [c.slug, c.nombre]));
const listaMaterias = (materias ?? []).map((m: any) => `  MAT:${m.slug} = ${m.nombre} (${m.descripcion})`).join('\n');
const listaColectivos = (colectivos ?? []).map((c: any) => `  COL:${c.slug} = ${c.nombre} (${c.descripcion})`).join('\n');

const ESQUEMA = {
  type: 'object',
  properties: {
    frase_corta: { type: 'string' },
    resumen: { type: 'string' },
    puntos_clave: { type: 'array', items: { type: 'string' } },
    que_cambia: { type: 'array', items: { type: 'string' } },
    a_quien_afecta: { type: 'string' },
    entrada_en_vigor: { type: 'string' },
    materia_principal: { type: 'string' },
    afectados: {
      type: 'array',
      items: {
        type: 'object',
        properties: { colectivo: { type: 'string' }, efecto: { type: 'string' } },
        required: ['colectivo', 'efecto']
      }
    },
    suficiente_informacion: { type: 'boolean' }
  },
  required: ['frase_corta', 'resumen', 'puntos_clave', 'que_cambia', 'a_quien_afecta', 'entrada_en_vigor', 'materia_principal', 'afectados', 'suficiente_informacion']
};

const MULETILLA = /^\s*(?:est[ae]\s+(?:propuesta|norma|ley|iniciativa|proposici[óo]n|proyecto|moci[óo]n)|el\s+texto|la\s+iniciativa|la\s+presente)\b/i;
const HUECO = /\b(?:xx+|__+|\.\.\.|\[\s*\.{2,}\s*\]|\[[^\]]*rellenar[^\]]*\])\b/i;
const ARTICULADO = /\b(?:art[íi]culo\s+(?:único|primero|1\b)|PROPOSICI[ÓO]N NO DE LEY\s*\n|MOCI[ÓO]N\s*\n|\n\s*1\.\s+(?:El Parlamento|La Asamblea))/i;

function fragmentar(texto: string, tope: number): string {
  const limpio = String(texto ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (limpio.length <= tope) return limpio;
  const marca = limpio.search(ARTICULADO);
  const cuerpo = marca > 0 ? limpio.slice(marca) : limpio;
  if (cuerpo.length <= tope) return cuerpo;
  const p = Math.floor(tope / 3);
  const medio = Math.floor(cuerpo.length / 2);
  return [cuerpo.slice(0, p), '\n[…fragmento omitido del texto oficial…]\n', cuerpo.slice(medio - Math.floor(p / 2), medio + Math.floor(p / 2)), '\n[…fragmento omitido del texto oficial…]\n', cuerpo.slice(-p)].join('');
}

function marco(i: any, esLey: boolean): string {
  const quien = i.proponente ?? 'quien la presenta';
  if (esLey && i.texto_clase === 'ley') return `Es una LEY aprobada por ${O.nombre}: describe lo que establece ("La ley establece…", "Crea…", "Obliga a…").`;
  if (esLey) return `Es un TEXTO PRESENTADO por ${quien}, antes de debatirse. No sabes si se aprobó ni cómo cambió. Prohibido escribir que ${O.corto} lo aprobó o lo estableció: escribe lo que el texto PROPONE ("Propone crear…", "El proyecto prevé…").`;
  const comun = `NO ES UNA LEY: es una iniciativa de impulso o de control (proposición no de ley, moción u otra). No cambia por sí sola ninguna norma.
- Resume la parte que se somete a votación (los puntos numerados), no la exposición de motivos.
- Las afirmaciones y valoraciones de la exposición de motivos son de quien la presenta: no las repitas como hechos.`;
  if (i.texto_clase === 'aprobado') return `${comun}
- Este es el TEXTO APROBADO por el Pleno: escribe lo que ${O.corto} pide, insta o declara y a quién ("${O.Corto} insta a ${O.gobierno} a…").
- En afectados, el efecto empieza por "${O.Corto} pide".`;
  return `${comun}
- Este es el TEXTO PRESENTADO por ${quien}, antes de votarse. NO sabes si el Pleno lo aprobó o lo rechazó.
- PROHIBIDO escribir "${O.Corto} pide", "${O.Corto} insta", "${O.Corto} declara", "${O.Corto} reafirma" o cualquier frase que dé a entender que ${O.corto} lo adoptó.
- Escribe lo que la iniciativa PROPONE: "Propone que ${O.corto} inste a ${O.gobierno} a…", "Pide crear…".
- En afectados, el efecto empieza por "Se propone".`;
}

function prompt(i: any): { texto: string; chars: number } {
  const fuente = fragmentar(i.texto_extraido, MAX_CHARS);
  const recortado = fuente.includes('[…fragmento omitido');
  const esLey = LEYES.has(i.tipo);
  const texto = `Eres documentalista parlamentario. Explicas iniciativas ${O.nombre.startsWith('el ') ? `del ${O.nombre.slice(3)}` : `de ${O.nombre}`} a ciudadanos sin formación jurídica.

TIPO: ${i.tipo_nombre ?? i.tipo ?? 'no consta'}
EXTRACTO OFICIAL: ${i.extracto ?? 'no consta'}
PRESENTADA POR: ${i.proponente ?? 'no consta'}
ESTADO: ${i.estado ?? 'no consta'}

${CLASE[i.texto_clase] ?? 'TEXTO'}, PUBLICADO POR ${O.nombre.toUpperCase()} (${O.boletin} o registro de la cámara):
---
${fuente}
---
${recortado ? 'AVISO: el texto está recortado y faltan fragmentos marcados. Resume solo lo que puedas leer. Si lo que falta te impide describirlo, responde suficiente_informacion = false.' : 'El texto de arriba está completo.'}

${marco(i, esLey)}

REGLAS ESTRICTAS:
- Usa SOLO el texto de arriba. Si algo no está ahí, no lo digas.
- Prohibido valorar: nada de "necesaria", "polémica", "beneficia", "perjudica", "recorta", "mejora", "ataca".
- Prohibido atribuir intenciones, en cualquier tiempo verbal: nada de "busca", "pretende", "pretendía", "persigue", "trata de", "tiene como objetivo", "con el fin de". Di lo que el texto HACE, PIDE o PROPONE.
- Nombra cada norma con su tipo exacto tal como sale en el texto: un real decreto no es una ley, un proyecto de real decreto no es un proyecto de ley, un decreto ley no es una ley.
- Prohibido especular sobre consecuencias no escritas en el texto.
- No escribas frases sobre lo que el texto no contiene ni comentarios sobre el propio texto: solo su contenido.
- Si trata de un colectivo, una enfermedad, un territorio, un sector o una ley concreta, NÓMBRALO.
- Si el texto trae un hueco sin rellenar (XX, __, puntos suspensivos entre corchetes), escribe "No consta en el texto".
- Español de España, frases cortas, sin jerga jurídica. Cada frase termina en punto.

CAMPOS:
- frase_corta: UNA frase completa de entre 30 y ${MAX_FRASE} caracteres que se entienda sola. Empieza directo por el contenido concreto. Prohibido empezar por "La norma", "La proposición", "regula", "establece", "aprueba", "modifica". Prohibido "mejorar" o "reforzar" sin decir qué: di la medida concreta. Sin puntos suspensivos, sin partido autor, sin adjetivos valorativos.${esLey ? '' : i.texto_clase === 'aprobado' ? ' Al no ser una ley, que se note: "Pide al Gobierno regional…", "Insta al Gobierno de España a…".' : ' Al ser una propuesta presentada, que se note: "Propone pedir al Gobierno regional…", "Propone instar al Gobierno de España a…".'}
- resumen: 3 a 5 frases. La primera debe poder leerse sola como resumen de todo. Prohibido empezar por "Esta propuesta", "Esta ley", "El texto" o "La iniciativa".
- puntos_clave: 3 a 5 ${esLey ? 'medidas concretas' : 'peticiones o acuerdos concretos'}, cada uno en una frase, con cifras, plazos o artículos si el texto los da.
- que_cambia: ${esLey ? '2 a 4 elementos con el formato "Antes X. Ahora Y." solo cuando el texto permita deducirlo. Lista vacía si no.' : 'lista vacía.'}
- a_quien_afecta: SOLO los colectivos de personas, empresas o sectores que menciona el texto, separados por comas. Los gobiernos y administraciones a los que se dirige la petición no son colectivos afectados. Si no nombra ninguno: "El texto no nombra colectivos concretos".
- entrada_en_vigor: lo que diga el texto, o "No consta en el texto".
- materia_principal: una sola, de esta lista, SIN el prefijo MAT:
${listaMaterias}
- afectados: de 0 a 5 colectivos de esta lista, SIN el prefijo COL:, solo aquellos sobre los que el texto ${esLey ? 'cambia algo concreto' : 'pide o propone algo concreto'}. Usa un colectivo solo si corresponde exactamente a las personas del texto: los jóvenes de hasta 35 años no son menores, un gobierno no es un colectivo. Si ninguno corresponde exactamente, deja la lista vacía:
${listaColectivos}
  efecto: UNA frase de máximo 22 palabras ${esLey ? (i.texto_clase === 'ley' ? 'que diga qué les cambia en la práctica' : 'que diga qué propone el texto para ellos') : 'que diga qué se pide o se propone para ellos, con el comienzo indicado arriba'}. Sin valorar.
- suficiente_informacion: false si el texto es ilegible, es solo una nota de trámite o está tan recortado que no se puede describir.`;
  return { texto, chars: fuente.length };
}

function validarFrase(f: unknown): string | null {
  const t = String(f ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (t.length < 12 || t.includes('…') || t.endsWith('...') || MULETILLA.test(t)) return null;
  if (/^(la\s+norma|la\s+ley|la\s+proposici[óo]n|se\s+regula|regula|establece|aprueba|modifica)\b/i.test(t)) return null;
  return t.slice(0, 180);
}

function limpiarHueco(t: unknown): string | null {
  const s = String(t ?? '').trim();
  if (!s || HUECO.test(s) || /^no\s+consta/i.test(s)) return null;
  return s;
}

const hechas = await traerTodo<any>((a, b) => db().from('parl_resumenes')
  .select('expediente, version_prompt, texto_url').eq('camara', CAMARA).order('expediente').range(a, b));
const hecha = new Map(hechas.map((r: any) => [r.expediente, r]));

const todas = await traerTodo<any>((a, b) => db().from('parl_iniciativas')
  .select('expediente, legislatura, tipo, tipo_nombre, proponente, extracto, estado, texto_url, texto_fuente, texto_clase, texto_chars')
  .eq('camara', CAMARA).gt('texto_chars', 400).order('legislatura', { ascending: false }).order('expediente').range(a, b));

const pendientesTodas = todas.filter((i: any) => {
  const r = hecha.get(i.expediente);
  return !r || r.version_prompt !== VERSION || r.texto_url !== i.texto_url;
});
const pendientes = LIMITE ? pendientesTodas.slice(0, LIMITE) : pendientesTodas;

console.log(`\n${O.Corto}${O.nombre.slice(O.corto.length)} · modelo: ${modeloActivo()} · versión ${VERSION}`);
console.log(`Iniciativas con texto: ${todas.length} · ya resumidas: ${todas.length - pendientesTodas.length} · pendientes: ${pendientesTodas.length}${LIMITE ? ` (se hacen ${pendientes.length})` : ''}\n`);

const ADOPCION = /\b(?:el parlamento(?: de andaluc[íi]a)?|la asamblea(?: de madrid)?)\s+(?:pide|insta|declara|reafirma|exige|solicita|acuerda|rechaza|condena|reclama|manifiesta|muestra|apoya|considera|requiere|urge)\b/i;

const cuenta = { adopcion: 0, insuficientes: 0, fraseRechazada: 0, sinAfectados: 0, inventados: new Set<string>(), errores: new Map<string, number>() };
const anotar = (e: string) => cuenta.errores.set(e, (cuenta.errores.get(e) ?? 0) + 1);

async function resumirUna(i: any, cadencia: Cadencia): Promise<true | null> {
  const { data: fila, error: eLectura } = await db().from('parl_iniciativas').select('texto_extraido')
    .eq('camara', CAMARA).eq('expediente', i.expediente).single();
  if (eLectura) { anotar(`lectura: ${eLectura.message}`); return null; }
  i.texto_extraido = fila?.texto_extraido ?? '';
  const { texto, chars } = prompt(i);
  const r = await preguntar<any>(texto, cadencia, { esquema: ESQUEMA });
  if (!r.ok || !r.datos) { anotar(r.error ?? 'sin detalle'); return null; }
  if (!r.datos.suficiente_informacion) { cuenta.insuficientes++; return null; }

  if (!LEYES.has(i.tipo) && i.texto_clase === 'presentado') {
    const todo = [r.datos.frase_corta, r.datos.resumen, ...(r.datos.puntos_clave ?? []), ...(r.datos.afectados ?? []).map((a: any) => a.efecto)].join(' ');
    if (ADOPCION.test(todo)) { cuenta.adopcion++; anotar(`descartado: un texto presentado se resumió como si la cámara lo hubiera adoptado (${i.expediente})`); return null; }
  }

  const frase = validarFrase(r.datos.frase_corta);
  if (!frase) cuenta.fraseRechazada++;
  const vigor = limpiarHueco(r.datos.entrada_en_vigor);
  const puntos = [
    ...(Array.isArray(r.datos.puntos_clave) ? r.datos.puntos_clave : []),
    ...(LEYES.has(i.tipo) && Array.isArray(r.datos.que_cambia) ? r.datos.que_cambia : []).map((c: string) => `Cambio: ${c}`),
    vigor ? `Entrada en vigor: ${vigor}` : null
  ].filter(p => String(p ?? '').trim().length > 0);
  const sinPrefijo = (t: unknown) => String(t ?? '').replace(/^(?:MAT|COL):/i, '').trim();
  r.datos.materia_principal = sinPrefijo(r.datos.materia_principal);
  for (const a of Array.isArray(r.datos.afectados) ? r.datos.afectados : []) a.colectivo = sinPrefijo(a.colectivo);
  const materia = slugMateria.has(r.datos.materia_principal) ? r.datos.materia_principal : null;
  if (!materia && r.datos.materia_principal) cuenta.inventados.add(`materia:${r.datos.materia_principal}`);
  const efectos = (Array.isArray(r.datos.afectados) ? r.datos.afectados : []).slice(0, 5).map((a: any) => {
    if (!nombreColectivo.has(a.colectivo)) { cuenta.inventados.add(`colectivo:${a.colectivo}`); return null; }
    if (!a.efecto || String(a.efecto).length < 20) return null;
    return { slug: a.colectivo, nombre: nombreColectivo.get(a.colectivo), efecto: String(a.efecto).slice(0, 300) };
  }).filter(Boolean);
  if (!efectos.length) cuenta.sinAfectados++;

  const { error } = await db().from('parl_resumenes').upsert({
    camara: CAMARA,
    expediente: i.expediente,
    version_prompt: VERSION,
    modelo: r.modelo ?? modeloActivo(),
    frase_corta: frase,
    resumen: String(r.datos.resumen ?? '').trim(),
    puntos_clave: puntos,
    a_quien_afecta: String(r.datos.a_quien_afecta ?? '').trim() || null,
    materia_slug: materia,
    efectos,
    texto_url: i.texto_url,
    basado_en: i.texto_clase,
    chars_fuente: chars,
    creado_at: new Date().toISOString()
  }, { onConflict: 'camara,expediente' });
  if (error) { anotar(`escritura: ${error.message}`); return null; }
  return true;
}

const progreso = await procesarLote(pendientes, async (i: any, cadencia: Cadencia) => {
  try { return await resumirUna(i, cadencia); } finally { delete i.texto_extraido; }
}, {
  alProgreso: (n, total, i: any, ok) => {
    if (n % 10 === 0 || !ok) console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${i.expediente} ${String(i.extracto ?? '').slice(0, 60)}`);
  }
});

console.log('\nRESULTADO');
console.log(`  resumidas:            ${progreso.procesados}`);
console.log(`  sin información sufic.: ${cuenta.insuficientes}`);
console.log(`  fallidas:             ${progreso.fallidos - cuenta.insuficientes - cuenta.adopcion}`);
console.log(`  descartadas por decir que la cámara adoptó un texto solo presentado: ${cuenta.adopcion}`);
console.log(`  omitidas (cuota):     ${progreso.omitidos}`);
console.log(`  frase corta rechazada: ${cuenta.fraseRechazada} (la web usa el extracto oficial)`);
console.log(`  sin colectivos:       ${cuenta.sinAfectados}`);
if (cuenta.inventados.size) console.log(`  identificadores inventados (descartados): ${[...cuenta.inventados].slice(0, 10).join(', ')}`);
for (const [e, n] of [...cuenta.errores].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`  ${String(n).padStart(4)}  ${e.slice(0, 130)}`);

if (LIMITE) console.log(`\nMuestra de ${LIMITE}. Revisa esos resúmenes en la web antes de lanzar el resto (quedan ${pendientesTodas.length - progreso.procesados}).`);
await refrescarCaches();
console.log('Caché de la web refrescada.\n');
