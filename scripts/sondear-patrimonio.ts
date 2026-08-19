import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';
import { extractText, getDocumentProxy } from 'unpdf';

const avisoOriginal = console.warn;
console.warn = (...a: any[]) => { if (!/glyf|TT:|undefined function/i.test(String(a[0] ?? ''))) avisoOriginal(...a); };

function filas(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const k of Object.keys(json)) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && typeof json[k] === 'object') {
      for (const k2 of Object.keys(json[k])) if (Array.isArray(json[k][k2])) return json[k][k2];
    }
  }
  return [];
}

console.log('\n=== 1. FICHEROS DE DECLARACIONES ===\n');
const html = await descargarHtml(`${BASE_CONGRESO}/es/opendata/diputados`);
const todos = extraerUrls(html, /webpublica\/opendata\/[^"'\s<>]+\.(json|csv|xml)/);
todos.forEach(u => console.log('  ' + u));

const decl = masReciente(todos.filter(u => /acteco|bienes|declara|patrimoni|renta/i.test(u)));
if (!decl) {
  console.log('\nNo se encontro fichero de declaraciones. Busca a mano en la pagina.\n');
  process.exit(1);
}

console.log(`\n=== 2. CONTENIDO DE ${decl.split('/').pop()} ===\n`);
const res = await fetch(decl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
const bruto = await res.text();
console.log(`  ${(bruto.length / 1024).toFixed(0)} KB`);

let datos: any[] = [];
try { datos = filas(JSON.parse(bruto)); } catch { console.log('  No es JSON valido'); }

if (datos.length === 0) { console.log('  Sin registros reconocibles'); process.exit(1); }

console.log(`  ${datos.length} registros\n`);
console.log('  CAMPOS DEL PRIMERO:');
Object.keys(datos[0]).forEach(k => {
  const v = String(datos[0][k] ?? '');
  console.log(`    ${k.padEnd(32)} ${v.slice(0, 90)}`);
});

const urlsPdf = Object.entries(datos[0]).filter(([, v]) => String(v ?? '').includes('http'));
console.log(`\n  Campos con URL: ${urlsPdf.map(([k]) => k).join(', ') || 'NINGUNO'}`);

if (urlsPdf.length === 0) {
  console.log('\n  Sin enlaces a PDF. No se puede extraer patrimonio de este fichero.\n');
  process.exit(0);
}

const [campoUrl] = urlsPdf[0];
const muestra = datos.find((d: any) => String(d[campoUrl] ?? '').startsWith('http'));

console.log(`\n=== 3. EXTRAYENDO UN PDF DE MUESTRA ===`);
console.log('  ' + muestra[campoUrl]);

try {
  const r = await fetch(muestra[campoUrl], { headers: { 'User-Agent': UA } });
  const buf = new Uint8Array(await r.arrayBuffer());
  console.log(`  HTTP ${r.status}  ${(buf.length / 1024).toFixed(0)} KB`);

  if (String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') {
    console.log('  NO es un PDF.');
    process.exit(1);
  }

  const pdf = await getDocumentProxy(buf);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const limpio = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  console.log(`  ${totalPages} paginas, ${limpio.length} caracteres extraidos`);

  if (limpio.length < 300) {
    console.log('\n  DIAGNOSTICO: PDF escaneado sin capa de texto. Haria falta OCR.\n');
    process.exit(0);
  }

  console.log('\n  PRIMEROS 1800 CARACTERES:\n');
  console.log(limpio.slice(0, 1800).split('\n').map(l => '    ' + l).join('\n'));

  const cifras = limpio.match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?/g) ?? [];
  console.log(`\n  Cifras con formato español encontradas: ${cifras.length}`);
  console.log('  ejemplos: ' + cifras.slice(0, 12).join(' · '));

  const secciones = ['bienes inmuebles', 'depositos', 'depósitos', 'valores', 'deudas',
    'vehiculos', 'vehículos', 'planes de pensiones', 'sociedades', 'actividades'];
  console.log('\n  SECCIONES DETECTADAS:');
  secciones.forEach(sec => {
    const hay = new RegExp(sec, 'i').test(limpio);
    if (hay) console.log('    ' + sec);
  });

  console.log('\n  DIAGNOSTICO: extraible. Se puede montar el adapter.\n');
} catch (e: any) {
  console.log('  ERROR ' + e.message);
}

export {};
