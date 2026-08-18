import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';

function extraerFilas(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const k of Object.keys(json)) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && typeof json[k] === 'object') {
      for (const k2 of Object.keys(json[k])) if (Array.isArray(json[k][k2])) return json[k][k2];
    }
  }
  throw new Error('sin array');
}

console.log('\n=== 1. LOCALIZANDO UNA INTERVENCION DE DEBATE REAL ===');

const html = await descargarHtml(`${BASE_CONGRESO}/es/opendata/intervenciones`);
const url = masReciente(
  extraerUrls(html, /webpublica\/opendata\/intervenciones\/[^"'\s<>]+\.json/).filter(u =>
    /Cronologicamente/i.test(u)
  )
)!;

const res = await fetch(url, { headers: { 'User-Agent': UA } });
const filas = extraerFilas(await res.json());

const debates = filas.filter(
  (f: any) =>
    f.ORGANO === 'Pleno' &&
    f.CARGOORADOR?.includes('Diputad') &&
    !/Juramento|Cuestión de orden/i.test(f.FASE ?? '') &&
    f.ENLACETEXTOINTEGRO
);

console.log(`  ${filas.length} intervenciones totales`);
console.log(`  ${debates.length} de diputados en Pleno, fuera de tramites`);

const muestra = debates[Math.floor(debates.length / 2)];
console.log('\n  MUESTRA:');
console.log(`    orador:  ${muestra.ORADOR}`);
console.log(`    objeto:  ${(muestra.OBJETOINICIATIVA ?? '').slice(0, 80)}`);
console.log(`    fase:    ${muestra.FASE}`);
console.log(`    sesion:  ${muestra.SESION}  ${muestra.INICIOINTERVENCION}-${muestra.FININTERVENCION}`);

console.log('\n=== 2. PROBANDO ENLACETEXTOINTEGRO ===');
console.log('  ' + muestra.ENLACETEXTOINTEGRO.slice(0, 160));

try {
  const r = await fetch(muestra.ENLACETEXTOINTEGRO, {
    headers: { 'User-Agent': UA, Accept: 'text/html' }
  });
  const cuerpo = await r.text();
  console.log(`  HTTP ${r.status}  ${(cuerpo.length / 1024).toFixed(0)} KB`);

  const sinEtiquetas = cuerpo
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const apellido = String(muestra.ORADOR).split(',')[0];
  const pos = sinEtiquetas.indexOf(apellido);
  console.log(`  apellido "${apellido}" encontrado: ${pos >= 0 ? 'SI en pos ' + pos : 'NO'}`);

  if (pos >= 0) {
    console.log('\n  CONTEXTO (600 car. tras el apellido):');
    console.log('  ' + sinEtiquetas.slice(pos, pos + 600));
  } else {
    console.log('\n  PRIMEROS 500 CAR. DE TEXTO VISIBLE:');
    console.log('  ' + sinEtiquetas.slice(0, 500));
  }
} catch (e) {
  console.log('  ERROR ' + e);
}

console.log('\n=== 3. PROBANDO EL PDF DEL DIARIO DE SESIONES ===');
console.log('  ' + muestra.ENLACEPDF);
try {
  const r = await fetch(muestra.ENLACEPDF, { headers: { 'User-Agent': UA } });
  const buf = await r.arrayBuffer();
  const cabecera = new TextDecoder().decode(buf.slice(0, 8));
  console.log(`  HTTP ${r.status}  ${(buf.byteLength / 1024).toFixed(0)} KB  cabecera "${cabecera.trim()}"`);
  console.log(`  ${cabecera.startsWith('%PDF') ? 'Es un PDF valido. Extraible con pdf-parse.' : 'NO es PDF.'}`);
} catch (e) {
  console.log('  ERROR ' + e);
}

console.log('\n=== 4. TIEMPO DE PALABRA (sin necesidad de texto) ===');

function minutos(ini: string, fin: string): number {
  const p = (s: string) => {
    const [h, m] = String(s).split(':').map(Number);
    return h * 60 + m;
  };
  const d = p(fin) - p(ini);
  return d >= 0 ? d : d + 1440;
}

const porOrador = new Map<string, { n: number; min: number }>();
debates.forEach((f: any) => {
  if (!f.INICIOINTERVENCION || !f.FININTERVENCION) return;
  const k = String(f.ORADOR).replace(/\s*\([^)]*\)\s*/g, '').trim();
  const a = porOrador.get(k) ?? { n: 0, min: 0 };
  a.n++;
  a.min += minutos(f.INICIOINTERVENCION, f.FININTERVENCION);
  porOrador.set(k, a);
});

const ranking = Array.from(porOrador.entries()).sort((a, b) => b[1].min - a[1].min);
console.log(`  ${porOrador.size} diputados con intervenciones de debate`);
console.log(`  de los 410 del censo => ${((porOrador.size / 410) * 100).toFixed(0)}% habla alguna vez`);
console.log('\n  TOP 15 POR MINUTOS EN TRIBUNA:');
ranking.slice(0, 15).forEach(([n, a], i) =>
  console.log(`    ${String(i + 1).padStart(2)}. ${n.padEnd(42)} ${String(a.min).padStart(5)} min  ${String(a.n).padStart(4)} intervenciones`)
);

const conAlMenos5 = ranking.filter(([, a]) => a.n >= 5).length;
console.log(`\n  con >= 5 intervenciones: ${conAlMenos5} diputados`);
console.log(`  => techo realista para un eje de discurso individual`);
console.log('');

export {};
