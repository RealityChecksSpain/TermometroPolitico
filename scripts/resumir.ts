import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_PROMPT ?? 'v3-frase-corta-2026-08';
const SOLO_CON_TEXTO = process.env.SOLO_CON_TEXTO !== 'false';

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

function promptConTexto(i: any): string {
  return `Eres documentalista parlamentario. Explicas normas del Congreso de los Diputados a ciudadanos sin formación jurídica.

TITULO OFICIAL: ${i.titulo}
PRESENTADA POR: ${i.autor_texto ?? 'no consta'}
SITUACION: ${i.situacion ?? 'no consta'}

TEXTO OFICIAL PUBLICADO EN EL BOLETIN OFICIAL DE LAS CORTES GENERALES:
---
${String(i.texto_extraido).slice(0, Number(process.env.MAX_CHARS_PROMPT ?? 25000))}
---

REGLAS ESTRICTAS:
- Usa SOLO el texto de arriba. Si algo no está ahí, no lo digas.
- Prohibido valorar: nada de "necesaria", "polémica", "beneficia", "perjudica", "recorta", "mejora", "ataca".
- Prohibido especular sobre consecuencias políticas, económicas o sociales no escritas en el texto.
- Cuando el texto cite artículos o leyes concretas, nómbralos.
- Español de España, frases cortas, sin jerga jurídica. Si usas un término técnico, explícalo entre paréntesis.
- No repitas el título. Quien lee ya lo ha visto. Explica el CONTENIDO.

CAMPOS:
- frase_corta: UNA sola frase, máximo 50 caracteres (~8-10 palabras). Empieza directo por el contenido: "Cribado neonatal cada dos años", "Plan de respuesta a Oriente Medio". PROHIBIDO empezar por "La norma", "regula", "establece", "aprueba", "modifica". Sin jerga. Sin partido autor. Sin adjetivos valorativos.
- resumen: 3 a 5 frases. Qué establece la norma en la práctica. Concreto, no genérico.
- puntos_clave: 3 a 5 medidas concretas que introduce, cada una en una frase. Con cifras, plazos o artículos si el texto los da.
- que_cambia: 2 a 4 elementos con el formato "Antes X. Ahora Y." solo cuando el texto lo permita deducir. Lista vacía si no.
- a_quien_afecta: colectivos concretos que menciona el texto.
- entrada_en_vigor: lo que diga el texto, o "No consta en el texto".
- suficiente_informacion: false solo si el texto es ilegible o no contiene articulado.`;
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

const pendientes = todas.filter((i: any) => !hechas.has(i.id));

console.log(`\nModelo:    ${modeloActivo()}`);
console.log(`Version:   ${VERSION}`);
console.log(`Fuente:    texto integro del BOCG`);
console.log(`Pendientes: ${pendientes.length}`);
if (pendientes.length > 0) {
  const media = Math.round(pendientes.reduce((a: number, i: any) => a + (i.texto_chars ?? 0), 0) / pendientes.length);
  console.log(`Tamaño medio: ${media.toLocaleString('es')} caracteres\n`);
}

if (!pendientes.length) {
  console.log(
    (todas ?? []).length === 0
      ? 'No hay iniciativas con texto descargado. Ejecuta antes: npm run textos\n'
      : `Nada pendiente: las ${hechas.size} iniciativas con texto ya tienen resumen ${VERSION}.\n`
  );
  console.log('Comprueba el estado global con: npm run estado:ia\n');
  process.exit(0);
}

let insuficientes = 0;
const errores = new Map<string, number>();

const progreso = await procesarLote(
  pendientes,
  async (i: any, cadencia: Cadencia) => {
    const r = await preguntar<any>(promptConTexto(i), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      const e = r.error ?? 'sin detalle';
      errores.set(e, (errores.get(e) ?? 0) + 1);
      return null;
    }
    if (!r.datos.suficiente_informacion) { insuficientes++; return null; }

    const puntos = [
      ...(r.datos.puntos_clave ?? []),
      ...(r.datos.que_cambia ?? []).map((c: string) => `Cambio: ${c}`)
    ];

    const { error: e } = await db().from('resumenes_ia').upsert({
      iniciativa_id: i.id,
      modelo: r.modelo ?? modeloActivo(),
      version_prompt: VERSION,
      resumen: r.datos.resumen,
      frase_corta: String(r.datos.frase_corta ?? '').slice(0, 180) || null,
      puntos_clave: puntos,
      a_quien_afecta: [r.datos.a_quien_afecta, r.datos.entrada_en_vigor && r.datos.entrada_en_vigor !== 'No consta en el texto'
        ? `Entrada en vigor: ${r.datos.entrada_en_vigor}` : null].filter(Boolean).join(' · '),
      tokens_entrada: r.tokensEntrada ?? null,
      tokens_salida: r.tokensSalida ?? null,
      basado_en: 'texto_bocg',
      chars_fuente: i.texto_chars ?? null,
      revisado: false
    }, { onConflict: 'iniciativa_id,version_prompt' });

    return e ? null : true;
  },
  {
    alProgreso: (n, total, i: any, ok) => {
      if (n % 10 === 0 || !ok) {
        console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${String(i.titulo).slice(0, 58)}`);
      }
    }
  }
);

console.log('\nRESULTADO');
console.log(`  resumidas:     ${progreso.procesados}`);
console.log(`  sin info suf.: ${insuficientes}`);
console.log(`  fallidas:      ${progreso.fallidos}`);
console.log(`  omitidas:      ${progreso.omitidos}`);

if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 140)}`));
}

await db().rpc('refrescar_metricas');
console.log('\nMetricas refrescadas.\n');

export {};