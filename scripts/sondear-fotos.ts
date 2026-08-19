import { descargarHtml, extraerUrls, BASE_CONGRESO, UA } from '../src/lib/descubrir';

console.log('\n=== BUSCANDO EL PATRON DE FOTO ===\n');

const paginas = [
  `${BASE_CONGRESO}/es/busqueda-de-diputados`,
  `${BASE_CONGRESO}/busqueda-de-diputados`,
  `${BASE_CONGRESO}/es/diputados`
];

const patrones = [
  [/[a-z0-9/_.-]*fotos?[a-z0-9/_.-]*\.(jpg|jpeg|png)/i, 'ruta con "foto"'],
  [/[a-z0-9/_.-]*diputad[a-z0-9/_.-]*\.(jpg|jpeg|png)/i, 'ruta con "diputad"'],
  [/webpublica\/[a-z0-9/_.-]+\.(jpg|jpeg|png)/i, 'webpublica'],
  [/documents\/[a-z0-9/_.-]+\.(jpg|jpeg|png)/i, 'documents'],
  [/o\/[a-z0-9/_.-]*imagen[a-z0-9/_.-]*/i, 'servicio de imagen'],
  [/image\/[a-z0-9/_.-]+/i, 'ruta image']
];

const todo = new Set<string>();

for (const url of paginas) {
  let html = '';
  try {
    html = await descargarHtml(url);
    console.log(`  ${url}  ->  ${(html.length / 1024).toFixed(0)} KB`);
  } catch (e: any) {
    console.log(`  ${url}  ->  ${String(e.message).slice(0, 50)}`);
    continue;
  }

  patrones.forEach(([p, nombre]) => {
    const encontradas = extraerUrls(html, p as RegExp);
    if (encontradas.length) {
      console.log(`     ${nombre}: ${encontradas.length}`);
      encontradas.slice(0, 4).forEach(u => { console.log('       ' + u); todo.add(u); });
    }
  });

  const imgs = Array.from(new Set(html.match(/<img[^>]+src=["']([^"']+)["']/gi) ?? []))
    .map(t => (t.match(/src=["']([^"']+)["']/i) ?? [])[1])
    .filter(Boolean)
    .filter(u => !/logo|icon|banner|escudo|bandera|\.svg/i.test(String(u)));

  if (imgs.length) {
    console.log(`     etiquetas <img> relevantes: ${imgs.length}`);
    imgs.slice(0, 8).forEach(u => console.log('       ' + u));
  }

  const conId = Array.from(new Set(html.match(/[a-z0-9/_.-]*\d{3,6}[a-z0-9/_.-]*\.(jpg|jpeg|png)/gi) ?? []));
  if (conId.length) {
    console.log(`     imagenes con numero en el nombre: ${conId.length}`);
    conId.slice(0, 8).forEach(u => console.log('       ' + u));
  }

  await new Promise(r => setTimeout(r, 800));
}

console.log('\n=== PROBANDO PATRONES CONOCIDOS PARA EL ID 316 (Abascal) ===\n');

const candidatas = [
  `${BASE_CONGRESO}/docu/imgdipu/000316.jpg`,
  `${BASE_CONGRESO}/imgdipu/000316.jpg`,
  `${BASE_CONGRESO}/webpublica/fotos/000316.jpg`,
  `${BASE_CONGRESO}/o/diputado-imagen/316`,
  `${BASE_CONGRESO}/documents/diputados/316.jpg`,
  `${BASE_CONGRESO}/docu/fotos/leg15/000316.jpg`
];

for (const url of candidatas) {
  try {
    const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    const tipo = r.headers.get('content-type') ?? '';
    console.log(`  ${r.ok && tipo.includes('image') ? 'OK   ' : 'falla'}  ${r.status}  ${tipo.slice(0, 24).padEnd(26)} ${url}`);
  } catch (e: any) {
    console.log(`  falla        ${url}  ${String(e.message).slice(0, 30)}`);
  }
  await new Promise(r => setTimeout(r, 400));
}

console.log(`
Si ninguna funciona: en la ficha de Abascal, boton derecho sobre su foto
-> "Copiar direccion de la imagen" y pegamela. Con una deduzco las 350.
`);

export {};
