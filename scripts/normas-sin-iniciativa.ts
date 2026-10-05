import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import { refrescarMetricas } from '../src/lib/metricas';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');
const ESCRIBIR = process.argv.includes('--escribir');
const LIMITE = Number(process.argv.find(a => a.startsWith('--limite='))?.split('=')[1] ?? 0);
const METODO = process.argv.find(a => a.startsWith('--metodo='))?.split('=')[1] ?? 'derivada';

const TRAMITE = /(enmienda|dictamen|veto|art[ií]culo|disposici[oó]n|apartado|votaci[oó]n separada|punto n)/i;

const FORMAS: { patron: RegExp; tipo: string; tipoTexto: string; origen: string }[] = [
  { patron: /^\s*real\s+decreto[-\s]?ley/i, tipo: 'otro', tipoTexto: 'Real Decreto-ley', origen: 'gobierno' },
  { patron: /^\s*real\s+decreto\s+legislativo/i, tipo: 'otro', tipoTexto: 'Real Decreto Legislativo', origen: 'gobierno' },
  { patron: /^\s*proposici[oó]n\s+no\s+de\s+ley/i, tipo: 'otro', tipoTexto: 'Proposición no de Ley', origen: 'grupo_parlamentario' },
  { patron: /^\s*moci[oó]n/i, tipo: 'otro', tipoTexto: 'Moción', origen: 'grupo_parlamentario' },
  { patron: /^\s*interpelaci[oó]n/i, tipo: 'otro', tipoTexto: 'Interpelación', origen: 'grupo_parlamentario' },
  { patron: /^\s*(tratado|convenio|convenci[oó]n|protocolo|canje\s+de\s+notas|acuerdo\s+entre\s+el\s+reino)/i, tipo: 'otro', tipoTexto: 'Tratado internacional', origen: 'gobierno' },
  { patron: /^\s*acuerdo\s+del\s+gobierno/i, tipo: 'otro', tipoTexto: 'Acuerdo del Gobierno', origen: 'gobierno' },
  { patron: /^\s*(proposici[oó]n|propuesta)\s+de\s+reforma\s+del\s+reglamento/i, tipo: 'otro', tipoTexto: 'Reforma del Reglamento', origen: 'grupo_parlamentario' },
  { patron: /entre\s+el\s+reino\s+de\s+espa[nñ]a\s+y\s|,\s*hech[oa]s?\s+en\s+[^,]{2,60}?\s+el\s+\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}/i, tipo: 'otro', tipoTexto: 'Tratado internacional', origen: 'gobierno' }
];

function formaDe(titular: string) {
  return FORMAS.find(f => f.patron.test(titular)) ?? null;
}

function autorDe(titular: string): string | null {
  const m = titular.match(/Grupo\s+Parlamentario\s+[^,.(]{2,70}?(?=\s+(?:sobre|relativ|para|por|acerca|en\s+relaci|urgente|solicit)\b|[,.(]|$)/i);
  if (m) return m[0].trim();
  if (/^\s*real\s+decreto/i.test(titular)) return 'Gobierno';
  if (/^\s*acuerdo\s+del\s+gobierno/i.test(titular)) return 'Gobierno';
  return null;
}

const votaciones = await traerTodo<any>((a, b) =>
  db().from('votaciones').select('id, titulo, subtitulo, fecha').order('id').range(a, b));

const enlaces = await traerTodo<any>((a, b) =>
  db().from('votacion_iniciativa').select('votacion_id, metodo').order('votacion_id').range(a, b));

const yaEnlazadas = new Set(enlaces.map((e: any) => e.votacion_id));

const metodosEnUso = new Map<string, number>();
for (const e of enlaces) {
  const m = String(e.metodo ?? '(nulo)');
  metodosEnUso.set(m, (metodosEnUso.get(m) ?? 0) + 1);
}

const huerfanas = votaciones.filter((v: any) => !yaEnlazadas.has(v.id));

type Ficha = { titular: string; fecha: string | null; votaciones: string[]; forma: typeof FORMAS[number] };

const porNorma = new Map<string, Ficha>();
const desconocidas = new Map<string, number>();
let tramites = 0;
let sinForma = 0;

for (const v of huerfanas) {
  const titular = String(v.subtitulo ?? v.titulo ?? '').trim();
  if (!titular) continue;
  if (TRAMITE.test(String(v.titulo ?? ''))) { tramites++; continue; }

  const forma = formaDe(titular);
  if (!forma) {
    sinForma++;
    const arranque = titular.split(/[,(]/)[0].split(/\s+/).slice(0, 5).join(' ');
    desconocidas.set(arranque, (desconocidas.get(arranque) ?? 0) + 1);
    continue;
  }

  const ficha: Ficha = porNorma.get(titular) ?? { titular, fecha: v.fecha ?? null, votaciones: [] as string[], forma };
  ficha.votaciones.push(v.id);
  if (v.fecha && (!ficha.fecha || v.fecha < ficha.fecha)) ficha.fecha = v.fecha;
  porNorma.set(titular, ficha);
}

const normas = Array.from(porNorma.values()).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
const elegidas = LIMITE ? normas.slice(0, LIMITE) : normas;

const porForma = new Map<string, number>();
for (const n of normas) porForma.set(n.forma.tipoTexto, (porForma.get(n.forma.tipoTexto) ?? 0) + 1);

console.log('\nVOTACIONES SIN INICIATIVA');
console.log(`  votaciones en la base:      ${votaciones.length}`);
console.log(`  ya enlazadas:               ${yaEnlazadas.size}`);
console.log(`  huerfanas:                  ${huerfanas.length}`);
console.log(`    de tramite, se descartan: ${tramites}`);
console.log(`    forma no reconocida:      ${sinForma}`);
console.log(`  normas distintas a crear:   ${normas.length}`);

console.log('\nPOR FORMA');
Array.from(porForma.entries()).sort((a, b) => b[1] - a[1])
  .forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));

console.log('\nVALORES DE metodo YA PRESENTES EN votacion_iniciativa');
Array.from(metodosEnUso.entries()).sort((a, b) => b[1] - a[1])
  .forEach(([m, n]) => console.log(`  ${String(n).padStart(4)}  ${m}`));
console.log(`  se escribira con metodo = ${METODO}`);
if (!metodosEnUso.has(METODO)) {
  console.log('  ese valor no aparece todavia. Si la columna es un enum, fallara:');
  console.log('  en ese caso repite con --metodo=<uno de los de arriba>');
}

if (desconocidas.size) {
  console.log('\nFORMAS NO RECONOCIDAS (no se crean, revisa si falta alguna)');
  Array.from(desconocidas.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([a, n]) => console.log(`  ${String(n).padStart(4)}  ${a}`));
}

console.log('\nPRIMERAS QUE SE CREARIAN');
elegidas.slice(0, 8).forEach(n => {
  const dia = String(n.fecha ?? '').slice(0, 10) || '          ';
  console.log(`  ${dia}  ${String(n.forma.tipoTexto).padEnd(22)} ${String(n.votaciones.length).padStart(2)}v`);
  console.log(`              ${n.titular.slice(0, 150)}`);
});

if (!ESCRIBIR) {
  console.log('\nSIMULACION. No se ha escrito nada.');
  console.log('Para crearlas de verdad: npm run normas:huerfanas -- --escribir\n');
  process.exit(0);
}

console.log(`\nEscribiendo ${elegidas.length} iniciativas derivadas...\n`);

let creadas = 0;
let enlazadas = 0;
let fallos = 0;
let falloEnlace: string | null = null;

for (let i = 0; i < elegidas.length; i += 100) {
  const trozo = elegidas.slice(i, i + 100);

  const filas = trozo.map(n => ({
    legislatura_id: legislaturaId,
    expediente: `DERIVADA/${n.votaciones[0]}`,
    tipo: n.forma.tipo,
    titulo: n.titular,
    estado: 'presentada',
    origen: n.forma.origen,
    fecha_presentacion: n.fecha ?? '2023-08-17',
    autor_texto: autorDe(n.titular),
    tipo_texto: n.forma.tipoTexto,
    supertipo: 'Derivada de votacion',
    situacion: null,
    enlaces_bocg: null,
    boletin_url: null,
    fuente_url: 'derivado:votacion'
  }));

  const { data, error } = await db()
    .from('iniciativas')
    .upsert(filas, { onConflict: 'legislatura_id,expediente' })
    .select('id, expediente');

  if (error) { console.error('  ' + error.message); fallos += trozo.length; continue; }

  const idPorExpediente = new Map((data ?? []).map((r: any) => [r.expediente, r.id]));
  creadas += data?.length ?? 0;

  const puentes: any[] = [];
  for (const n of trozo) {
    const iniciativaId = idPorExpediente.get(`DERIVADA/${n.votaciones[0]}`);
    if (!iniciativaId) continue;
    for (const votacionId of n.votaciones) {
      puentes.push({ votacion_id: votacionId, iniciativa_id: iniciativaId, similitud: 1, metodo: METODO });
    }
  }

  if (puentes.length) {
    const { error: e2 } = await db()
      .from('votacion_iniciativa')
      .upsert(puentes, { onConflict: 'votacion_id,iniciativa_id' });
    if (e2) { console.error('  enlace: ' + e2.message); falloEnlace = e2.message; }
    else enlazadas += puentes.length;
  }

  console.log(`  [${String(Math.min(i + 100, elegidas.length)).padStart(4)}/${elegidas.length}] creadas ${creadas}  enlaces ${enlazadas}`);
}

console.log('\nRESULTADO');
console.log(`  iniciativas derivadas: ${creadas}`);
console.log(`  enlaces escritos:      ${enlazadas}`);
console.log(`  fallos:                ${fallos}`);

if (enlazadas === 0 && creadas > 0) {
  console.log('\n  SIN ENLACES: las iniciativas estan creadas pero no apuntan a ninguna votacion,');
  console.log('  asi que la web no vera ninguna materia nueva. No se ha perdido nada:');
  console.log('  arregla el motivo y vuelve a correr, que las iniciativas se reutilizan.');
  if (falloEnlace) console.log(`  motivo: ${falloEnlace}`);
  console.log('\n  NO ejecutes clasificar hasta que esto salga con enlaces.');
}

if (enlazadas > 0) await refrescarMetricas();

console.log('\nLlevan expediente DERIVADA/... y fuente_url derivado:votacion.');
console.log('Se borran con: delete from iniciativas where fuente_url = \'derivado:votacion\';');
console.log('\nSIGUIENTE: npm run clasificar\n');

export {};