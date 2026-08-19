import { descargarHtml, extraerUrls, BASE_CONGRESO, UA } from '../src/lib/descubrir';
import { getDocumentProxy, extractText } from 'unpdf';

const avisoOriginal = console.warn;
console.warn = (...a: any[]) => { if (!/glyf|TT:|undefined function/i.test(String(a[0] ?? ''))) avisoOriginal(...a); };

const CONOCIDA = 'https://www.congreso.es/docbienes/leg15/000316/000316_001_e_0001872_20230921.pdf';
const ID_PRUEBA = 316;

console.log('\n=== 1. EXTRACCION DEL PDF CONOCIDO ===\n');
console.log('  ' + CONOCIDA);

try {
  const r = await fetch(CONOCIDA, { headers: { 'User-Agent': UA } });
  const buf = new Uint8Array(await r.arrayBuffer());
  console.log(`  HTTP ${r.status}  ${(buf.length / 1024).toFixed(0)} KB`);

  if (String.fromCharCode(...buf.slice(0, 4)) === '%PDF') {
    const pdf = await getDocumentProxy(buf);

    let campos: any = null;
    try { campos = await (pdf as any).getFieldObjects(); } catch {}

    if (campos && Object.keys(campos).length > 0) {
      const nombres = Object.keys(campos);
      console.log(`\n  FORMULARIO CON ${nombres.length} CAMPOS — extraccion fiable`);
      nombres.slice(0, 40).forEach(n => {
        const v = campos[n]?.[0]?.value;
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          console.log(`    ${n.slice(0, 44).padEnd(46)} ${String(v).slice(0, 44)}`);
        }
      });
    } else {
      console.log('\n  Sin campos de formulario. Se parseara el texto.');
    }

    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const limpio = text.replace(/[ \t]+/g, ' ').trim();
    console.log(`\n  TEXTO: ${totalPages} paginas, ${limpio.length} caracteres`);

    const importes = limpio.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) ?? [];
    console.log(`  Importes detectados: ${importes.length}`);
    console.log('  ejemplos: ' + importes.slice(0, 12).join(' · '));

    console.log('\n  SECCIONES:');
    ['RENDIMIENTOS NETOS DEL TRABAJO', 'BIENES PATRIMONIALES', 'DEP[OÓ]SITOS',
     'DEUDAS', 'VEH[IÍ]CULOS', 'PLANES DE PENSIONES', 'ACCIONES', 'TOTAL']
      .forEach(sec => { if (new RegExp(sec, 'i').test(limpio)) console.log('    ' + sec); });

    console.log('\n  PRIMEROS 1200 CARACTERES:\n');
    console.log(limpio.slice(0, 1200).split('\n').map(l => '    ' + l).join('\n'));
  }
} catch (e: any) {
  console.log('  ERROR ' + e.message);
}

console.log('\n\n=== 2. PATRON DE LA FICHA DEL DIPUTADO ===\n');

const patrones = [
  (id: number) => `${BASE_CONGRESO}/busqueda-de-diputados?p_p_id=diputadomodulo&_diputadomodulo_idDiputado=${id}`,
  (id: number) => `${BASE_CONGRESO}/es/busqueda-de-diputados?p_p_id=diputadomodulo&p_p_lifecycle=0&_diputadomodulo_idDiputado=${id}`,
  (id: number) => `${BASE_CONGRESO}/es/busqueda-de-diputados?_diputadomodulo_idDiputado=${id}`,
  (id: number) => `${BASE_CONGRESO}/es/busqueda-de-diputados?idDiputado=${id}`,
  (id: number) => `${BASE_CONGRESO}/es/diputados/ficha?idDiputado=${id}`
];

let ganador: ((id: number) => string) | null = null;

for (const patron of patrones) {
  const url = patron(ID_PRUEBA);
  try {
    const html = await descargarHtml(url);
    const pdfs = extraerUrls(html, /docbienes\/leg\d+\/\d+\/[^"'\s<>]+\.pdf/i);
    const acts = extraerUrls(html, /docu\/[a-z]*acteco[^"'\s<>]*\.pdf/i);
    const nombre = (html.match(/<h1[^>]*>([^<]{5,80})<\/h1>/i)?.[1] ?? '').trim();

    console.log(`  ${pdfs.length ? 'OK   ' : 'falla'}  ${url.slice(0, 96)}`);
    if (nombre) console.log(`         nombre en la pagina: ${nombre}`);
    if (pdfs.length) {
      pdfs.forEach(u => console.log('         ' + u));
      if (acts.length) console.log(`         + ${acts.length} de actividades`);
      ganador = patron;
      break;
    }
  } catch (e: any) {
    console.log(`  falla  ${url.slice(0, 96)}  ${String(e.message).slice(0, 34)}`);
  }
  await new Promise(r => setTimeout(r, 800));
}

console.log('\n=== RESULTADO ===');
if (ganador) {
  console.log('\n  Patron de ficha encontrado. Se puede recorrer id 1..400 y sacar');
  console.log('  los PDF de los 350 diputados. Listo para montar el adapter.\n');
} else {
  console.log(`
  Ninguna URL de ficha funciona. La pagina carga por JavaScript.

  QUE HACER:
    1. En la ficha de Abascal, F12 -> pestaña Red -> recarga.
    2. Copia la URL de la peticion del documento principal (la que devuelve el HTML).
    3. Pegamela.
`);
}

export {};