import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { preguntar, procesarLote, modeloActivo, Cadencia } from '../src/lib/gemini';

exigirEnv('GEMINI_API_KEY');
const VERSION = process.env.VERSION_CLASIF ?? 'clasif-v1-2026-08';

const { data: materias } = await db().from('materias').select('id, slug, nombre, descripcion').order('codigo_cap');
const { data: colectivos } = await db().from('colectivos').select('id, slug, nombre, descripcion').order('orden');

const idMateria = new Map((materias ?? []).map((m: any) => [m.slug, m.id]));
const idColectivo = new Map((colectivos ?? []).map((c: any) => [c.slug, c.id]));

const listaMaterias = (materias ?? []).map((m: any) => `  MAT:${m.slug} = ${m.nombre} (${m.descripcion})`).join('\n');
const listaColectivos = (colectivos ?? []).map((c: any) => `  COL:${c.slug} = ${c.nombre} (${c.descripcion})`).join('\n');

const ESQUEMA = {
  type: 'object',
  properties: {
    materia_principal: { type: 'string' },
    materias_secundarias: { type: 'array', items: { type: 'string' } },
    afectados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          colectivo: { type: 'string' },
          efecto: { type: 'string' }
        },
        required: ['colectivo', 'efecto']
      }
    }
  },
  required: ['materia_principal', 'materias_secundarias', 'afectados']
};

function prompt(i: any): string {
  const fuente = i.texto_extraido
    ? `TEXTO OFICIAL (BOCG):\n---\n${String(i.texto_extraido).slice(0, Number(process.env.MAX_CHARS_PROMPT ?? 25000))}\n---`
    : `RESUMEN DISPONIBLE: ${i.resumen ?? '(ninguno)'}`;

  return `Clasificas normas del Congreso de los Diputados para una herramienta ciudadana.

TITULO: ${i.titulo}
${fuente}

MATERIAS — de que trata la norma. Elige EXACTAMENTE una principal y de 0 a 3 secundarias.
Devuelve el identificador SIN el prefijo MAT:
${listaMaterias}

COLECTIVOS AFECTADOS — sobre quien recae. Elige de 1 a 5.
Devuelve el identificador SIN el prefijo COL:
${listaColectivos}

REGLAS ESTRICTAS:
- Son DOS listas distintas. Un identificador COL: nunca vale como materia, ni al reves.
- Usa SOLO identificadores de la lista correspondiente. Si inventas uno, la respuesta se descarta.
- materia_principal: la que mejor describe el objeto central de la norma. Una sola.
- No incluyas la principal entre las secundarias.
- afectados: NO listes colectivos genericamente relacionados. Solo aquellos a quienes el texto cambia algo concreto.
- efecto: UNA frase, maximo 22 palabras, en segunda persona del plural o impersonal, diciendo QUE LES CAMBIA en la practica.
  Ejemplo bueno: "La cuota mínima baja de 230 a 200 euros al mes durante los tres primeros años de actividad."
  Ejemplo malo: "Afecta a los autónomos." (no dice nada)
  Ejemplo malo: "Perjudica a los autónomos." (valora)
- Prohibido valorar: nada de beneficia, perjudica, mejora, recorta, ataca, protege.
- Si el texto no permite decir que cambia para un colectivo, no lo incluyas.
- Español de España, sin jerga.`;
}

const yaHechas = await traerTodo<any>((a, b) =>
  db().from('iniciativa_materia').select('iniciativa_id')
    .eq('version_prompt', VERSION).order('iniciativa_id').range(a, b));
const hechas = new Set(yaHechas.map((r: any) => r.iniciativa_id));

const todas = await traerTodo<any>((a, b) =>
  db().from('iniciativas').select('id, titulo, texto_extraido, texto_chars').order('id').range(a, b));

const pendientes = todas.filter((i: any) => !hechas.has(i.id));

console.log(`\nModelo: ${modeloActivo()}`);
console.log(`Materias: ${materias?.length ?? 0} · Colectivos: ${colectivos?.length ?? 0}`);
console.log(`Pendientes: ${pendientes.length}\n`);

if (!pendientes.length) {
  console.log(
    (todas ?? []).length === 0
      ? 'No hay iniciativas cargadas. Ejecuta antes: npm run iniciativas\n'
      : `Nada pendiente: las ${hechas.size} iniciativas ya estan clasificadas (${VERSION}).\n`
  );
  console.log('Comprueba el estado global con: npm run estado:ia\n');
  process.exit(0);
}

const errores = new Map<string, number>();
const inventados = new Set<string>();
let sinAfectados = 0;

const progreso = await procesarLote(
  pendientes,
  async (i: any, cadencia: Cadencia) => {
    const r = await preguntar<any>(prompt(i), cadencia, { esquema: ESQUEMA });
    if (!r.ok || !r.datos) {
      const e = r.error ?? 'sin detalle';
      errores.set(e, (errores.get(e) ?? 0) + 1);
      return null;
    }

    const principal = idMateria.get(r.datos.materia_principal);
    if (!principal) {
      inventados.add(`materia:${r.datos.materia_principal}`);
      return null;
    }

    const filasMateria: any[] = [
      { iniciativa_id: i.id, materia_id: principal, principal: true, modelo: r.modelo ?? modeloActivo(), version_prompt: VERSION }
    ];

    (r.datos.materias_secundarias ?? []).slice(0, 3).forEach((s: string) => {
      const id = idMateria.get(s);
      if (!id) { inventados.add(`materia:${s}`); return; }
      if (id === principal) return;
      filasMateria.push({ iniciativa_id: i.id, materia_id: id, principal: false, modelo: r.modelo ?? modeloActivo(), version_prompt: VERSION });
    });

    await db().from('iniciativa_materia').upsert(filasMateria, { onConflict: 'iniciativa_id,materia_id' });

    const filasColectivo = (r.datos.afectados ?? [])
      .slice(0, 5)
      .map((a: any) => {
        const id = idColectivo.get(a.colectivo);
        if (!id) { inventados.add(`colectivo:${a.colectivo}`); return null; }
        if (!a.efecto || String(a.efecto).length < 20) return null;
        return {
          iniciativa_id: i.id,
          colectivo_id: id,
          efecto: String(a.efecto).slice(0, 300),
          modelo: r.modelo ?? modeloActivo(),
          version_prompt: VERSION
        };
      })
      .filter(Boolean);

    if (filasColectivo.length === 0) sinAfectados++;
    else await db().from('iniciativa_colectivo').upsert(filasColectivo, { onConflict: 'iniciativa_id,colectivo_id' });

    return true;
  },
  {
    alProgreso: (n, total, i: any, ok) => {
      if (n % 10 === 0 || !ok) console.log(`  [${String(n).padStart(4)}/${total}] ${ok ? 'ok ' : '-- '} ${String(i.titulo).slice(0, 58)}`);
    }
  }
);

console.log('\nRESULTADO');
console.log(`  clasificadas:      ${progreso.procesados}`);
console.log(`  sin afectados:     ${sinAfectados}`);
console.log(`  fallidas:          ${progreso.fallidos}`);
console.log(`  omitidas:          ${progreso.omitidos}`);

if (inventados.size > 0) {
  console.log('\nIDENTIFICADORES INVENTADOS POR EL MODELO (descartados)');
  Array.from(inventados).slice(0, 15).forEach(x => console.log('  ' + x));
}
if (errores.size > 0) {
  console.log('\nERRORES');
  Array.from(errores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .forEach(([e, n]) => console.log(`  ${String(n).padStart(4)}  ${String(e).slice(0, 130)}`));
}

await db().rpc('refrescar_metricas');
console.log('\nMetricas refrescadas.\n');

export {};