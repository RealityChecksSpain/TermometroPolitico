import { readFileSync, existsSync } from 'node:fs';
import { db } from '../src/lib/supabase';
import { contarInmuebles } from '../src/lib/inmuebles.js';
import { refrescarMetricas } from '../src/lib/metricas';

const RUTA = 'datos/bienes/inmuebles-revisados-madrid.csv';
const CABECERA = ['diputado', 'buscar', 'declaracion', 'urbanos', 'rusticos', 'inmuebles_propios', 'inmuebles_sociedad', 'revisado', 'nota'];
const LARGO_NOTA = 600;
const aplicar = process.argv.includes('--aplicar');

function partirCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
      continue;
    }
    if (c === '"') { comillas = true; continue; }
    if (c === ',') { fila.push(campo); campo = ''; continue; }
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    if (c === '\r') continue;
    campo += c;
  }
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(v => v.trim() !== ''));
}

function llano(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function entero(v: string): number | null {
  return /^\d+$/.test(v.trim()) ? Number(v.trim()) : null;
}

if (!existsSync(RUTA)) {
  console.log(`\nNo existe ${RUTA}.\n`);
  process.exit(1);
}

const crudo = partirCSV(readFileSync(RUTA, 'utf8').replace(/^﻿/, ''));
const cabecera = (crudo[0] ?? []).map(c => c.trim());
const faltan = CABECERA.filter(c => !cabecera.includes(c));
if (faltan.length) {
  console.log(`\nFaltan columnas en ${RUTA}: ${faltan.join(', ')}\n`);
  process.exit(1);
}
const col = (f: string[], nombre: string) => (f[cabecera.indexOf(nombre)] ?? '').trim();

const [{ data: diputados, error: eDip }, { data: bienes, error: eBienes }] = await Promise.all([
  db().from('asamblea_diputados').select('id_asamblea, nombre_completo, activo'),
  db().from('asamblea_bienes').select('id_asamblea, url_declaracion, n_inmuebles, n_inmuebles_equivalentes, inmuebles_revisado')
]);
if (eDip) throw eDip;
if (eBienes) throw eBienes;
const bienesDe = new Map((bienes ?? []).map((b: any) => [String(b.id_asamblea), b]));
const personas = (diputados ?? []).map((d: any) => ({ id: String(d.id_asamblea), nombre: String(d.nombre_completo), activo: Boolean(d.activo), llano: llano(d.nombre_completo) }));

const problemas: string[] = [];
const cambios: { fila: number; id: string; nombre: string; antes: string; ahora: string; datos: Record<string, unknown> }[] = [];
const vistos = new Set<string>();

crudo.slice(1).forEach((f, i) => {
  const n = i + 2;
  const diputado = col(f, 'diputado');
  const buscar = llano(col(f, 'buscar'));
  const declaracion = col(f, 'declaracion');
  const urbanos = entero(col(f, 'urbanos'));
  const rusticos = entero(col(f, 'rusticos'));
  const propios = col(f, 'inmuebles_propios').replace(/\s+/g, ' ');
  const sociedad = col(f, 'inmuebles_sociedad').replace(/\s+/g, ' ');
  const revisado = col(f, 'revisado');
  const nota = col(f, 'nota').replace(/\s+/g, ' ');

  if (!diputado || !buscar) { problemas.push(`fila ${n}: faltan diputado o buscar`); return; }
  if (!/^RGEP\d+-\d{2}$/i.test(declaracion)) { problemas.push(`fila ${n} (${diputado}): declaracion "${declaracion}" no tiene la forma RGEP1234-23`); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(revisado) || Number.isNaN(Date.parse(revisado))) { problemas.push(`fila ${n} (${diputado}): revisado "${revisado}" no vale`); return; }
  if (urbanos === null || rusticos === null) { problemas.push(`fila ${n} (${diputado}): urbanos y rusticos van en numero entero`); return; }
  if (!propios && !sociedad) { problemas.push(`fila ${n} (${diputado}): sin inmuebles`); return; }
  if (nota.length > LARGO_NOTA) { problemas.push(`fila ${n} (${diputado}): nota de ${nota.length} caracteres, el maximo es ${LARGO_NOTA}`); return; }

  const conteo: Record<string, any> = contarInmuebles(null, urbanos, rusticos, propios || null, sociedad || null);
  if (conteo.n_inmuebles_propios !== urbanos + rusticos) {
    problemas.push(`fila ${n} (${diputado}): el texto de bienes propios da ${conteo.n_inmuebles_propios} inmuebles y urbanos + rusticos suman ${urbanos + rusticos}`);
    return;
  }

  const tokens = buscar.split(' ');
  const candidatos = personas.filter(p => tokens.every(t => p.llano.split(' ').includes(t)));
  const elegidos = candidatos.some(p => p.activo) ? candidatos.filter(p => p.activo) : candidatos;
  if (elegidos.length !== 1) {
    problemas.push(`fila ${n} (${diputado}): "${buscar}" coincide con ${elegidos.length ? elegidos.map(p => p.nombre).join(', ') : 'nadie'}`);
    return;
  }
  const persona = elegidos[0];
  if (vistos.has(persona.id)) { problemas.push(`fila ${n} (${diputado}): ${persona.nombre} ya aparece en otra fila`); return; }
  vistos.add(persona.id);

  const actual: any = bienesDe.get(persona.id);
  if (!actual) { problemas.push(`fila ${n} (${diputado}): no tiene declaración cargada. Corre antes npm run asamblea`); return; }
  const cargada = String(actual.url_declaracion ?? '').split('/').pop()?.replace(/\.pdf$/i, '') ?? '';
  if (cargada.toUpperCase() !== declaracion.toUpperCase()) {
    problemas.push(`fila ${n} (${diputado}): la revisión es de ${declaracion} y la declaración cargada es ${cargada || 'ninguna'}. Hay que revisar la nueva`);
    return;
  }

  cambios.push({
    fila: n,
    id: persona.id,
    nombre: persona.nombre,
    antes: `${actual.n_inmuebles ?? '-'} inm · ${actual.n_inmuebles_equivalentes ?? '-'} eq${actual.inmuebles_revisado ? ' (ya revisado)' : ''}`,
    ahora: `${conteo.n_inmuebles} inm · ${conteo.n_inmuebles_equivalentes} eq`,
    datos: {
      inmuebles_urbanos: urbanos,
      inmuebles_rusticos: rusticos,
      inmuebles_detalle_propios: propios || null,
      inmuebles_detalle_sociedad: sociedad || null,
      n_inmuebles: conteo.n_inmuebles,
      n_inmuebles_propios: conteo.n_inmuebles_propios,
      n_inmuebles_sociedad: conteo.n_inmuebles_sociedad,
      n_inmuebles_equivalentes: conteo.n_inmuebles_equivalentes,
      n_viviendas: conteo.n_viviendas,
      n_viviendas_propias: conteo.n_viviendas_propias,
      n_viviendas_equivalentes: conteo.n_viviendas_equivalentes,
      n_suelo: conteo.n_suelo,
      n_anejos: conteo.n_anejos,
      n_productivos: conteo.n_productivos,
      n_otros_bienes: conteo.n_otros_bienes,
      inmuebles_revisado: revisado
    }
  });
});

console.log(`\n${RUTA}: ${cambios.length} diputados\n`);
for (const c of cambios) console.log(`  ${c.nombre}\n    antes ${c.antes}\n    ahora ${c.ahora}`);

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s). No se ha escrito nada:\n`);
  for (const p of problemas) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}

if (!aplicar) {
  console.log('\nNo se ha escrito nada. Para guardar: npm run inmuebles:revisados:madrid -- --aplicar\n');
  process.exit(0);
}

let hechos = 0;
for (const c of cambios) {
  const { error } = await db().from('asamblea_bienes').update(c.datos).eq('id_asamblea', c.id);
  if (error) console.error(`  ${c.nombre}: ${error.message}`);
  else hechos++;
}
console.log(`\nGuardados ${hechos} de ${cambios.length}.\n`);
if (hechos) await refrescarMetricas();
