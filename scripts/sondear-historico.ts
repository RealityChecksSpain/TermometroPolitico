import { descargarHtml, extraerUrls } from '../src/lib/descubrir';

const BASE = 'https://www.congreso.es/es/opendata/votaciones';
const PATRON = /webpublica\/opendata\/votaciones\/Leg\d+\/Sesion\d+\/\d{8}\/Votacion\d+\/VOT_\d+\.json/;
const PATRON_ZIP = /webpublica\/opendata\/votaciones\/Leg\d+\/Sesion\d+\/\d{8}\/VOT_\d+\.zip/;

function sesionesDe(urls: string[]): Map<string, string> {
  const m = new Map<string, string>();
  urls.forEach(u => {
    const g = u.match(/\/Sesion(\d+)\/(\d{8})\//);
    if (g) m.set(g[1], g[2]);
  });
  return m;
}

async function sondear(etiqueta: string, url: string) {
  try {
    const html = await descargarHtml(url);
    const json = extraerUrls(html, PATRON);
    const zips = extraerUrls(html, PATRON_ZIP);
    const sesiones = sesionesDe([...json, ...zips]);
    const lista = Array.from(sesiones.entries())
      .map(([s, f]) => `S${s}/${f}`)
      .join(' ');
    console.log(
      `  ${etiqueta.padEnd(42)} json:${String(json.length).padStart(3)}  zip:${String(zips.length).padStart(2)}  ${lista || '-'}`
    );
    return sesiones;
  } catch (e: any) {
    console.log(`  ${etiqueta.padEnd(42)} ERROR ${e.message?.slice(0, 40)}`);
    return new Map<string, string>();
  }
}

const fechaIso = process.argv[2] ?? '2026-07-09';
const [a, m, d] = fechaIso.split('-');
const fechaEs = `${d}/${m}/${a}`;
const fechaCompacta = `${a}${m}${d}`;

console.log(`\nFecha de prueba: ${fechaIso}  (${fechaEs} / ${fechaCompacta})`);

console.log('\nBASE (sin parametros)');
const base = await sondear('base', BASE);
const sesionBase = Array.from(base.keys())[0] ?? '?';

const P = 'p_p_id=votaciones&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view';

const candidatos: [string, string][] = [
  ['?fecha=ES', `${BASE}?fecha=${encodeURIComponent(fechaEs)}`],
  ['?fecha=ISO', `${BASE}?fecha=${fechaIso}`],
  ['?fecha=COMPACTA', `${BASE}?fecha=${fechaCompacta}`],
  ['?_votaciones_fecha=ES', `${BASE}?_votaciones_fecha=${encodeURIComponent(fechaEs)}`],
  ['?_votaciones_fecha=ISO', `${BASE}?_votaciones_fecha=${fechaIso}`],
  ['portlet + fecha ES', `${BASE}?${P}&_votaciones_fecha=${encodeURIComponent(fechaEs)}`],
  ['portlet + fecha ISO', `${BASE}?${P}&_votaciones_fecha=${fechaIso}`],
  ['portlet + leg + fecha ES', `${BASE}?${P}&_votaciones_legislatura=XV&_votaciones_fecha=${encodeURIComponent(fechaEs)}`],
  ['portlet + mode + fecha ES', `${BASE}?${P}&_votaciones_mode=mostrarVotaciones&_votaciones_fecha=${encodeURIComponent(fechaEs)}`],
  ['?fechaSeleccionada=ES', `${BASE}?fechaSeleccionada=${encodeURIComponent(fechaEs)}`],
  ['?dia=ISO', `${BASE}?dia=${fechaIso}`],
  ['?_votaciones_dia=COMPACTA', `${BASE}?_votaciones_dia=${fechaCompacta}`],
  ['?legislatura=XV&fecha=ES', `${BASE}?legislatura=XV&fecha=${encodeURIComponent(fechaEs)}`],
  ['?sesion=192', `${BASE}?sesion=192`],
  ['?_votaciones_sesion=192', `${BASE}?${P}&_votaciones_sesion=192&_votaciones_legislatura=XV`]
];

console.log('\nCANDIDATOS');
const ganadores: string[] = [];
for (const [etiqueta, url] of candidatos) {
  const r = await sondear(etiqueta, url);
  const distinta = Array.from(r.keys()).some(s => s !== sesionBase);
  if (distinta) ganadores.push(`${etiqueta}  ->  ${url}`);
  await new Promise(res => setTimeout(res, 600));
}

console.log('\nCALENDARIO DE SESIONES');
try {
  const html = await descargarHtml('https://www.congreso.es/calendario-de-sesiones-plenarias');
  const fechas = Array.from(new Set(html.match(/\b\d{2}\/\d{2}\/20\d{2}\b/g) ?? []));
  console.log(`  fechas encontradas: ${fechas.length}`);
  console.log('  primeras: ' + fechas.slice(0, 12).join(' '));
  const nums = Array.from(new Set(html.match(/[Ss]esi[oó]n[^0-9]{0,20}(\d{1,3})/g) ?? []));
  console.log(`  menciones de sesion: ${nums.length}`);
  console.log('  ejemplos: ' + nums.slice(0, 8).join(' | '));
} catch (e: any) {
  console.log('  ERROR ' + e.message);
}

console.log('\nRESULTADO');
if (ganadores.length > 0) {
  console.log('  FORMAS QUE DEVUELVEN OTRA SESION:');
  ganadores.forEach(g => console.log('    ' + g));
} else {
  console.log('  Ninguna forma cambio de sesion. El calendario carga por JavaScript.');
  console.log('  Alternativa: abrir la pagina, pulsar un dia anterior en el calendario,');
  console.log('  copiar la URL resultante de la barra del navegador y pegarla aqui.');
}
console.log('');

export {};
