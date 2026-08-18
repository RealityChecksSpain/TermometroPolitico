import { readdir, readFile } from 'fs/promises';
import { db, exigirEnv } from '../src/lib/supabase';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';
import { extractText, getDocumentProxy } from 'unpdf';

const avisoOriginal = console.warn;
console.warn = (...args: any[]) => {
  const t = String(args[0] ?? '');
  if (/glyf|undefined function|TT:|Required .* table/i.test(t)) return;
  avisoOriginal(...args);
};

if (!process.argv.includes('--listar')) exigirEnv('GEMINI_API_KEY');

const CARPETA = process.env.CARPETA_PROGRAMAS ?? './programas';
const ELECCION = process.env.ELECCION ?? '2023-07-23';
const VERSION = 'promesas-v1-2026-08';
const CHUNK = Number(process.env.CHARS_CHUNK ?? 22000);
const SOLO_LISTAR = process.argv.includes('--listar');

const ESQUEMA = {
  type: 'object',
  properties: {
    promesas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          literal: { type: 'string' },
          materia: { type: 'string' },
          verificable: { type: 'boolean' }
        },
        required: ['texto', 'literal', 'materia', 'verificable']
      }
    }
  },
  required: ['promesas']
};

const { data: partidos } = await db().from('partidos').select('id, slug, siglas, nombre');
const { data: materias } = await db().from('materias').select('id, slug, nombre, descripcion').order('orden');
const idMateria = new Map((materias ?? []).map((m: any) => [m.slug, m.id]));
const listaMaterias = (materias ?? []).map((m: any) => `  ${m.slug} = ${m.nombre}`).join('\n');

function partidoDeFichero(nombre: string) {
  const base = nombre.toLowerCase().replace(/\.pdf$/, '');
  return (partidos ?? []).find((p: any) =>
    base.includes(p.slug) || base.includes(String(p.siglas).toLowerCase().replace(/\s/g, ''))
  );
}

function limpiar(t: string) {
  return t.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function trocear(texto: string, tam: number): string[] {
  const trozos: string[] = [];
  for (let i = 0; i < texto.length; i += tam) trozos.push(texto.slice(i, i + tam));
  return trozos;
}

function prompt(siglas: string, trozo: string): string {
  return `Extraes compromisos electorales del programa de ${siglas} para las elecciones generales.

FRAGMENTO DEL PROGRAMA:
---
${trozo}
---

MATERIAS:
${listaMaterias}

Extrae SOLO compromisos concretos de accion futura. Ignora diagnosticos, criticas al rival,
declaraciones de principios y relatos historicos.

Por cada compromiso:
- texto: reformulacion clara en una frase, empezando por un verbo de accion. Maximo 25 palabras.
- literal: la frase del programa tal cual aparece, recortada a 200 caracteres.
- materia: identificador de la lista. Si ninguno encaja, omite el compromiso entero.
- verificable: true solo si es comprobable con una votacion parlamentaria
  (crear, derogar, modificar, subir, bajar, prohibir, garantizar por ley una cifra o un derecho).
  false para intenciones vagas: "apostar por", "impulsar", "fomentar", "trabajar para".

Si el fragmento no contiene compromisos, devuelve lista vacia. No inventes nada.
Espanol de Espana. No valores el contenido.`;
}

let ficheros: string[];
try {
  ficheros = (await readdir(CARPETA)).filter(f => f.toLowerCase().endsWith('.pdf'));
} catch {
  console.error(`\nNo existe la carpeta ${CARPETA}.\n`);
  console.error('Crea la carpeta y pon dentro los PDF, con el nombre del partido en el fichero:');
  console.error('  programas/psoe.pdf  programas/pp.pdf  programas/sumar.pdf ...\n');
  console.error('Anade "programas/" al .gitignore: no redistribuyas los PDF.\n');
  process.exit(1);
}

console.log(`\nCarpeta: ${CARPETA}`);
console.log(`Ficheros PDF: ${ficheros.length}`);
if (SOLO_LISTAR) console.log('MODO COMPROBACION — no se llama a la IA ni se guardan promesas');
console.log('');
console.log('  PARTIDO     PAGINAS      CHARS  FRAGMENTOS  FICHERO');
console.log('  ' + '-'.repeat(74));

const trabajos: any[] = [];
const sinReconocer: string[] = [];
const cargados: string[] = [];
let fragmentosPrevistos = 0;

for (const fichero of ficheros) {
  const partido = partidoDeFichero(fichero);
  if (!partido) {
    console.log(`  SIN RECONOCER            ${fichero}`);
    sinReconocer.push(fichero);
    continue;
  }

  const buf = new Uint8Array(await readFile(`${CARPETA}/${fichero}`));
  const pdf = await getDocumentProxy(buf);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const limpio = limpiar(text);

  const trozosPrevios = Math.ceil(limpio.length / CHUNK);
  fragmentosPrevistos += trozosPrevios;
  console.log(
    `  ${partido.siglas.padEnd(11)} ${String(totalPages).padStart(6)}  ${limpio.length.toLocaleString('es').padStart(9)}  ${String(trozosPrevios).padStart(10)}  ${fichero}`
  );
  cargados.push(partido.siglas);

  if (limpio.length < 5000) {
    console.log(`              AVISO: muy poco texto. Puede ser un PDF escaneado sin capa de texto.`);
  }

  if (SOLO_LISTAR) continue;

  const { data: programa, error } = await db().from('programas').upsert({
    partido_id: partido.id,
    eleccion: ELECCION,
    fecha_eleccion: ELECCION,
    titulo: `Programa electoral ${partido.siglas} ${ELECCION.slice(0, 4)}`,
    fichero_origen: fichero,
    paginas: totalPages,
    chars: limpio.length
  }, { onConflict: 'partido_id,eleccion' }).select('id').single();

  if (error) { console.log(`  ERROR ${fichero}: ${error.message}`); continue; }

  trocear(limpio, CHUNK).forEach((t, i) =>
    trabajos.push({ programaId: programa.id, siglas: partido.siglas, trozo: t, indice: i })
  );
}

const { data: todosPartidos } = await db().from('partidos').select('siglas, slug');
const faltan = (todosPartidos ?? [])
  .filter((p: any) => !['mixto', 'sinGrupo'].includes(p.slug))
  .filter((p: any) => !cargados.includes(p.siglas))
  .map((p: any) => `${p.siglas} (${p.slug}.pdf)`);

if (sinReconocer.length > 0) {
  console.log('\nFICHEROS NO RECONOCIDOS');
  sinReconocer.forEach(f => console.log(`  ${f}`));
  console.log('  Renombralos incluyendo el slug del partido, por ejemplo: psoe.pdf, pp.pdf');
}

if (faltan.length > 0) {
  console.log('\nPARTIDOS SIN PROGRAMA CARGADO');
  faltan.forEach(f => console.log(`  ${f}`));
}

if (SOLO_LISTAR) {
  const minutos = Math.round((fragmentosPrevistos * 2.3) / 60);
  console.log(`\nProgramas reconocidos:   ${cargados.length}`);
  console.log(`Llamadas a la IA:        ${fragmentosPrevistos}`);
  console.log(`Tiempo estimado:         ~${minutos} min`);
  console.log(`Cuota diaria de Gemini:  1.500 peticiones`);
  console.log('\nSi los nombres y las paginas cuadran, ejecuta: npm run programas\n');
  process.exit(0);
}

console.log(`\nTotal de llamadas a la IA: ${trabajos.length}`);
console.log(`Tiempo estimado: ~${Math.round((trabajos.length * 2.3) / 60)} min\n`);

let promesasTotales = 0;
const materiasInventadas = new Set<string>();

const progreso = await procesarLote(
  trabajos,
  async (t: any, cadencia: Cadencia) => {
    const r = await preguntar<any>(prompt(t.siglas, t.trozo), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) return null;

    const filas = (r.datos.promesas ?? [])
      .map((p: any, k: number) => {
        const mId = idMateria.get(p.materia);
        if (!mId) { materiasInventadas.add(p.materia); return null; }
        if (!p.texto || String(p.texto).length < 15) return null;
        return {
          programa_id: t.programaId,
          texto: String(p.texto).slice(0, 400),
          literal: String(p.literal ?? '').slice(0, 400) || null,
          materia_id: mId,
          verificable: p.verificable === true,
          orden: t.indice * 100 + k,
          chunk: t.indice,
          modelo: modeloActivo(),
          version_prompt: VERSION
        };
      })
      .filter(Boolean);

    if (filas.length > 0) {
      const { error } = await db().from('promesas').insert(filas);
      if (error) return null;
      promesasTotales += filas.length;
    }
    return true;
  },
  {
    alProgreso: (n, total, t: any, ok) => {
      if (n % 5 === 0 || !ok) console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${t.siglas} fragmento ${t.indice}  (${promesasTotales} promesas)`);
    }
  }
);

console.log('\nRESULTADO');
console.log(`  fragmentos procesados: ${progreso.procesados}`);
console.log(`  promesas extraidas:    ${promesasTotales}`);
console.log(`  fallidos:              ${progreso.fallidos}`);
console.log(`  omitidos por cuota:    ${progreso.omitidos}`);
if (materiasInventadas.size > 0) {
  console.log(`\n  materias inventadas (descartadas): ${Array.from(materiasInventadas).slice(0, 10).join(', ')}`);
}

console.log('\nComprueba:  select * from v_programas;');
console.log('            select partido, count(*) from v_promesas where verificable group by partido;\n');

export {};