import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';

const URL_LISTADO = `${BASE_CONGRESO}/es/opendata/iniciativas`;

function extraerFilas(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const k of Object.keys(json)) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && typeof json[k] === 'object') {
      for (const k2 of Object.keys(json[k])) {
        if (Array.isArray(json[k][k2])) return json[k][k2];
      }
    }
  }
  throw new Error('No hay array reconocible. Claves raiz: ' + Object.keys(json).join(', '));
}

const html = await descargarHtml(URL_LISTADO);
const jsons = extraerUrls(html, /webpublica\/opendata\/[^"'\s<>]+\.json/);

console.log('\nFICHEROS PUBLICADOS');
jsons.forEach(u => console.log('  ' + u));

if (jsons.length === 0) {
  console.log('\nNinguno. Revisa la pagina a mano.');
  process.exit(1);
}

const elegido = masReciente(jsons)!;
console.log(`\nDESCARGANDO ${elegido}`);

const t0 = Date.now();
const res = await fetch(elegido, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
if (!res.ok) {
  console.log(`  HTTP ${res.status}`);
  process.exit(1);
}
const bruto = await res.text();
console.log(`  ${(bruto.length / 1024 / 1024).toFixed(1)} MB en ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const filas = extraerFilas(JSON.parse(bruto));
console.log(`  ${filas.length} iniciativas`);

const claves = Object.keys(filas[0]);
console.log('\nCAMPOS DEL PRIMER REGISTRO');
claves.forEach(k => {
  const v = filas[0][k];
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  console.log(`  ${k.padEnd(32)} [${String(s.length).padStart(6)}] ${s.slice(0, 70).replace(/\s+/g, ' ')}`);
});

console.log('\nDIAGNOSTICO');

const grupos = {
  expediente: claves.filter(k => /expediente|numexp|num_exp|codigo/i.test(k)),
  titulo: claves.filter(k => /titulo|objeto|texto|descripcion/i.test(k)),
  autor: claves.filter(k => /autor|proponente|presentad|grupo|formacion/i.test(k)),
  tipo: claves.filter(k => /tipo|clase/i.test(k)),
  estado: claves.filter(k => /estado|situacion|resultado|tramitacion/i.test(k)),
  fecha: claves.filter(k => /fecha/i.test(k)),
  enlace: claves.filter(k => /url|enlace|link|boletin|pdf/i.test(k))
};

Object.entries(grupos).forEach(([nombre, campos]) => {
  console.log(`  ${nombre.padEnd(12)} -> ${campos.join(', ') || 'NINGUNO'}`);
});

console.log('\nVALORES DISTINTOS');
for (const campo of [...grupos.tipo, ...grupos.estado, ...grupos.autor].slice(0, 4)) {
  const vals = new Map<string, number>();
  filas.forEach(f => {
    const v = String(f[campo] ?? '').trim();
    if (v) vals.set(v, (vals.get(v) ?? 0) + 1);
  });
  console.log(`\n  ${campo}  (${vals.size} distintos)`);
  Array.from(vals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([v, n]) => console.log(`    ${String(n).padStart(5)}  ${v.slice(0, 70)}`));
}

console.log('\nCRUCE CON VOTACIONES');
console.log('  El JSON de votaciones trae textoExpediente, por ejemplo:');
console.log('    "162/001234"  o  "Proposicion no de Ley ... Expediente 162/001234"');
if (grupos.expediente.length > 0) {
  const ejemplos = filas.slice(0, 5).map(f => grupos.expediente.map(k => f[k]).filter(Boolean).join(' | '));
  console.log('  Formato del expediente en iniciativas:');
  ejemplos.forEach(e => console.log('    ' + e));
  console.log('  => Si los formatos coinciden, el cruce es directo.');
} else {
  console.log('  => SIN campo de expediente. El cruce habria que hacerlo por titulo, mucho peor.');
}

console.log('\nTEXTO DISPONIBLE');
const conTexto = claves.filter(k => filas.slice(0, 300).some(f => typeof f[k] === 'string' && f[k].length > 300));
if (conTexto.length > 0) {
  console.log(`  campos con texto largo: ${conTexto.join(', ')}`);
  console.log('  => Resumenes con IA viables directamente.');
} else {
  console.log('  Sin texto largo. Solo titulos.');
  console.log('  => Los resumenes tendrian que partir del titulo + enlace al boletin (PDF).');
}

console.log('');
export {};
