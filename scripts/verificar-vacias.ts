import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';

exigirEnv('SUPABASE_URL');
const CLAVE = exigirEnv('GEMINI_API_KEY');

const argv = process.argv.slice(2);
const APLICAR = argv.includes('--aplicar');
const SOLO = argv.find(a => a.startsWith('--solo='))?.slice(7);
const LIMITE = Number(argv.find(a => a.startsWith('--limite='))?.slice(9) ?? Infinity);
const COPIAS_MADRID = resolve(argv.find(a => a.startsWith('--copias='))?.slice(9) ?? '../asamblea-sondeo/bienes');
const INFORMES = resolve('../lente-verificacion');
const PAUSA_MS = 4000;
const MARCA = 'segunda lectura';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const lista = (v?: string) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const MODELOS = [...new Set([...lista(process.env.MODELO_BIENES), ...lista(process.env.MODELO_IA), 'gemini-flash-latest', 'gemini-flash-lite-latest'])];
const retirados = new Set<string>();

const PROMPT = `Este PDF es una declaración de bienes patrimoniales de un cargo público español.
Mira SOLO los apartados de bienes inmuebles: urbanos, rústicos, los que tiene en propiedad y los que tiene a través de sociedades.
Responde en JSON:
- declara_inmuebles: true si aparece al menos un inmueble declarado en cualquiera de esos apartados (aunque sea una parte, una nuda propiedad o un garaje). false si todos esos apartados están vacíos, tachados o dicen «ninguno».
- filas: copia literal de cada fila de inmuebles que aparezca, separadas por " | ". Cadena vacía si no hay ninguna.
- legible: false si el documento está tan borroso, cortado o incompleto que no puedes saberlo.
- explicacion: una frase.
No inventes nada. Si dudas, legible: false.`;

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    declara_inmuebles: { type: 'BOOLEAN' },
    filas: { type: 'STRING' },
    legible: { type: 'BOOLEAN' },
    explicacion: { type: 'STRING' }
  },
  required: ['declara_inmuebles', 'filas', 'legible', 'explicacion']
};

type Juicio = { declara_inmuebles: boolean; filas: string; legible: boolean; explicacion: string };
type Caso = { camara: 'congreso' | 'madrid'; clave: string; nombre: string; partido: string; url: string | null; dudas: string | null; local?: string };

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

async function llamar(modelo: string, pdf: Buffer): Promise<{ juicio?: Juicio; error?: string; reintentar?: boolean }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(180000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CLAVE },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'application/pdf', data: pdf.toString('base64') } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: 'application/json', responseSchema: ESQUEMA }
      })
    });
    if (!res.ok) {
      const cuerpo = (await res.text()).replace(/\s+/g, ' ').slice(0, 160);
      if (res.status === 404 || /no longer available|NOT_FOUND/i.test(cuerpo)) {
        if (!retirados.has(modelo)) console.log(`  modelo retirado por Google, se descarta: ${modelo}`);
        retirados.add(modelo);
        return { error: `${modelo}: retirado` };
      }
      return { error: `${modelo}: HTTP ${res.status} ${cuerpo}`, reintentar: res.status === 429 || res.status >= 500 };
    }
    const cuerpo = await res.json();
    const texto = (cuerpo.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
    return { juicio: JSON.parse(texto.replace(/```json|```/g, '').trim()) };
  } catch (e) {
    return { error: `${modelo}: ${(e as Error).name === 'TimeoutError' ? 'sin respuesta en 3 minutos' : (e as Error).message}`, reintentar: true };
  }
}

async function preguntar(pdf: Buffer): Promise<{ juicio?: Juicio; modelo?: string; error?: string }> {
  const errores: string[] = [];
  for (const modelo of MODELOS) {
    if (retirados.has(modelo)) continue;
    for (let intento = 1; intento <= 2; intento++) {
      const r = await llamar(modelo, pdf);
      if (r.juicio) return { juicio: r.juicio, modelo };
      errores.push(r.error!);
      if (!r.reintentar) break;
      await esperar(intento * 20000);
    }
  }
  return { error: errores.join(' / ') || 'no queda ningún modelo disponible' };
}

async function casosCongreso(): Promise<Caso[]> {
  const filas = await traerTodo<any>((a, b) => db().from('bienes_declarados')
    .select('mandato_id, url_declaracion, dudas, n_inmuebles_equivalentes, inmuebles_detalle, inmuebles_detalle_propios, inmuebles_detalle_sociedad')
    .eq('n_inmuebles', 0).order('mandato_id').range(a, b));
  const ids = filas.map(f => f.mandato_id);
  const dips = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db().from('mv_diputados').select('mandato_id, nombre_completo, partido_siglas, activo').in('mandato_id', ids.slice(i, i + 200));
    for (const d of data ?? []) dips.set(d.mandato_id, d);
  }
  const urls = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db().from('mandatos').select('id, url_bienes').in('id', ids.slice(i, i + 200));
    for (const m of data ?? []) if (m.url_bienes) urls.set(m.id, m.url_bienes);
  }
  return filas
    .filter(f => dips.get(f.mandato_id)?.activo !== false)
    .map(f => ({
      camara: 'congreso' as const,
      clave: f.mandato_id,
      nombre: dips.get(f.mandato_id)?.nombre_completo ?? f.mandato_id,
      partido: dips.get(f.mandato_id)?.partido_siglas ?? '?',
      url: f.url_declaracion ?? urls.get(f.mandato_id) ?? null,
      dudas: f.dudas
    }));
}

async function casosMadrid(): Promise<Caso[]> {
  const { data, error } = await db().from('v_asamblea_diputados')
    .select('id_asamblea, nombre_completo, partido_siglas, url_declaracion, dudas')
    .eq('activo', true).eq('n_inmuebles', 0);
  if (error) throw error;
  return (data ?? []).map(d => ({
    camara: 'madrid' as const,
    clave: String(d.id_asamblea),
    nombre: d.nombre_completo,
    partido: d.partido_siglas ?? '?',
    url: d.url_declaracion,
    dudas: d.dudas,
    local: d.url_declaracion ? join(COPIAS_MADRID, `${d.id_asamblea}-${String(d.url_declaracion).split('/').pop()}`) : undefined
  }));
}

async function pdfDe(c: Caso): Promise<Buffer | null> {
  if (c.camara === 'madrid') {
    try { return await readFile(c.local!); } catch { return null; }
  }
  if (!c.url) return null;
  try {
    const r = await fetch(c.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.subarray(0, 4).toString() === '%PDF' ? buf : null;
  } catch {
    return null;
  }
}

async function anotar(c: Caso, nota: string, dudosa: boolean) {
  const dudas = [c.dudas, nota].filter(Boolean).join(' | ');
  const cambio: Record<string, any> = { dudas };
  if (dudosa) cambio.confianza = 'baja';
  const q = c.camara === 'congreso'
    ? db().from('bienes_declarados').update(cambio).eq('mandato_id', c.clave)
    : db().from('asamblea_bienes').update(cambio).eq('id_asamblea', Number(c.clave));
  const { error } = await q;
  if (error) console.log(`    no se pudo anotar: ${error.message}`);
}

function csv(v: unknown) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function main() {
  console.log(`\nSEGUNDA LECTURA DE DECLARACIONES SIN INMUEBLES  ${new Date().toISOString()}`);
  console.log(APLICAR ? 'Modo --aplicar: anota el resultado y marca como dudosas las que sí declaran inmuebles.\n' : 'Solo informe: no cambia nada en la base. Para anotar, añade --aplicar.\n');
  await mkdir(INFORMES, { recursive: true });

  const casos = [
    ...(SOLO === 'madrid' ? [] : await casosCongreso()),
    ...(SOLO === 'congreso' ? [] : await casosMadrid())
  ].filter(c => !String(c.dudas ?? '').includes(MARCA)).slice(0, LIMITE);
  console.log(`Declaraciones con cero inmuebles sin segunda lectura: ${casos.length}`);
  console.log(`Modelos, por orden: ${MODELOS.join(', ')}\n`);

  const informe = ['camara,partido,nombre,resultado,filas,explicacion,modelo,url'];
  const cuenta = { vacia: 0, con_inmuebles: 0, ilegible: 0, sin_pdf: 0, fallo: 0 };
  let n = 0;
  for (const c of casos) {
    n++;
    const pdf = await pdfDe(c);
    if (!pdf) {
      cuenta.sin_pdf++;
      console.log(`[${n}/${casos.length}] ${c.camara} ${c.partido} ${c.nombre}: no hay PDF${c.camara === 'madrid' ? ` (falta la copia ${c.local})` : ''}`);
      informe.push([c.camara, c.partido, c.nombre, 'sin_pdf', '', '', '', c.url].map(csv).join(','));
      continue;
    }
    const r = await preguntar(pdf);
    await esperar(PAUSA_MS);
    if (!r.juicio) {
      cuenta.fallo++;
      console.log(`[${n}/${casos.length}] ${c.camara} ${c.partido} ${c.nombre}: fallo de lectura (${r.error})`);
      informe.push([c.camara, c.partido, c.nombre, 'fallo', '', r.error, '', c.url].map(csv).join(','));
      continue;
    }
    const j = r.juicio;
    const resultado = !j.legible ? 'ilegible' : j.declara_inmuebles ? 'con_inmuebles' : 'vacia';
    cuenta[resultado]++;
    console.log(`[${n}/${casos.length}] ${c.camara} ${c.partido} ${c.nombre}: ${resultado.toUpperCase()}${j.filas ? ` · ${j.filas.slice(0, 160)}` : ''}`);
    informe.push([c.camara, c.partido, c.nombre, resultado, j.filas, j.explicacion, r.modelo, c.url].map(csv).join(','));
    if (APLICAR) {
      const fecha = new Date().toISOString().slice(0, 10);
      if (resultado === 'vacia') await anotar(c, `${MARCA} ${fecha}: confirma que no declara inmuebles`, false);
      else await anotar(c, `${MARCA} ${fecha}: ${resultado === 'ilegible' ? 'no se puede confirmar que esté vacía' : `declara inmuebles: ${j.filas.slice(0, 400)}`}`, true);
    }
  }

  const ruta = join(INFORMES, `vacias-${new Date().toISOString().slice(0, 10)}.csv`);
  await writeFile(ruta, '﻿' + informe.join('\n'));
  console.log(`\nRESUMEN: ${cuenta.vacia} vacías confirmadas, ${cuenta.con_inmuebles} SÍ declaran inmuebles, ${cuenta.ilegible} ilegibles, ${cuenta.sin_pdf} sin PDF, ${cuenta.fallo} fallos.`);
  if (APLICAR && (cuenta.con_inmuebles || cuenta.ilegible)) console.log('Las que declaran inmuebles o no se pueden confirmar quedan como lectura dudosa y salen de los hallazgos. Corre después en Supabase: select refrescar_metricas(); select crear_caches();');
  console.log(`Informe completo: ${ruta}`);
  console.log('FIN. Pega toda la salida.');
}

main().catch(e => { console.error(e); process.exit(1); });
