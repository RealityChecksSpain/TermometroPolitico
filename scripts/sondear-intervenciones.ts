import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';

const URL_LISTADO = `${BASE_CONGRESO}/es/opendata/intervenciones`;

function esTexto(v: any): boolean {
  return typeof v === 'string' && v.length > 150;
}

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
const jsons = extraerUrls(html, /webpublica\/opendata\/intervenciones\/[^"'\s<>]+\.json/);

console.log('\nFICHEROS PUBLICADOS');
jsons.forEach(u => console.log('  ' + u));

const crono = masReciente(jsons.filter(u => /Cronologicamente/i.test(u)));
const inicia = masReciente(jsons.filter(u => /Iniciativa/i.test(u)));
const elegido = crono ?? inicia ?? jsons[0];

if (!elegido) {
  console.log('\nNo se encontro ningun JSON. Revisa la pagina a mano.');
  process.exit(1);
}

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
console.log(`  ${filas.length} intervenciones`);

console.log('\nCAMPOS DEL PRIMER REGISTRO');
const claves = Object.keys(filas[0]);
claves.forEach(k => {
  const v = filas[0][k];
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  const marca = esTexto(v) ? '  <-- TEXTO LARGO' : '';
  console.log(`  ${k.padEnd(30)} [${String(s.length).padStart(6)}] ${s.slice(0, 70).replace(/\s+/g, ' ')}${marca}`);
});

console.log('\nDIAGNOSTICO');

const camposTexto = claves.filter(k => filas.slice(0, 200).some(f => esTexto(f[k])));
console.log(`  campos con texto largo: ${camposTexto.join(', ') || 'NINGUNO'}`);

if (camposTexto.length === 0) {
  console.log('  => Solo metadatos. Wordshoal NO es viable con este fichero.');
  console.log('     Habria que ir al Diario de Sesiones en PDF, o escalar programas electorales.');
} else {
  const largos = filas.filter(f => camposTexto.some(k => esTexto(f[k])));
  const media = largos.reduce((a, f) => a + Math.max(...camposTexto.map(k => String(f[k] ?? '').length)), 0) / (largos.length || 1);
  console.log(`  ${largos.length} de ${filas.length} tienen texto (media ${Math.round(media)} car.)`);
  console.log('  => Wordshoal VIABLE.');
}

const posiblesOrador = claves.filter(k => /diputado|orador|interviniente|nombre|apellido/i.test(k));
const posiblesDebate = claves.filter(k => /sesion|expediente|iniciativa|debate|orden|numero/i.test(k));
const posiblesFecha = claves.filter(k => /fecha/i.test(k));

console.log(`  campos de orador:  ${posiblesOrador.join(', ') || 'NINGUNO'}`);
console.log(`  campos de debate:  ${posiblesDebate.join(', ') || 'NINGUNO'}`);
console.log(`  campos de fecha:   ${posiblesFecha.join(', ') || 'NINGUNO'}`);

if (posiblesOrador.length > 0) {
  const oradores = new Set(filas.map(f => posiblesOrador.map(k => f[k]).filter(Boolean).join(' ')).filter(Boolean));
  console.log(`\n  oradores distintos: ${oradores.size}`);
  console.log('  ejemplos: ' + Array.from(oradores).slice(0, 6).join(' | '));
}

console.log('\nSEGUNDO REGISTRO (comprobar consistencia)');
if (filas[1]) {
  claves.forEach(k => {
    const s = String(filas[1][k] ?? '');
    console.log(`  ${k.padEnd(30)} ${s.slice(0, 60).replace(/\s+/g, ' ')}`);
  });
}
console.log('');

export {};
