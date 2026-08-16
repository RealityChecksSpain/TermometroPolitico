import { descargarHtml, extraerUrls, UA } from '../src/lib/descubrir';

const BASE = 'https://www.congreso.es/es/opendata/votaciones';
const PATRON = /webpublica\/opendata\/votaciones\/Leg\d+\/Sesion\d+\/\d{8}\/Votacion\d+\/VOT_\d+\.json/;
const PATRON_ZIP = /webpublica\/opendata\/votaciones\/Leg\d+\/Sesion\d+\/\d{8}\/VOT_\d+\.zip/;

const fechaIso = process.argv[2] ?? '2026-07-09';
const [a, m, d] = fechaIso.split('-');
const fechaEs = `${d}/${m}/${a}`;
const fechaCompacta = `${a}${m}${d}`;

function sesiones(texto: string): string[] {
  const urls = [...extraerUrls(texto, PATRON), ...extraerUrls(texto, PATRON_ZIP)];
  const s = new Set<string>();
  urls.forEach(u => {
    const g = u.match(/\/Sesion(\d+)\/(\d{8})\//);
    if (g) s.add(`S${g[1]}/${g[2]}`);
  });
  return Array.from(s);
}

async function probar(etiqueta: string, url: string, opciones: RequestInit = {}) {
  try {
    const res = await fetch(url, {
      ...opciones,
      headers: {
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: '*/*',
        ...(opciones.headers ?? {})
      }
    });
    const texto = await res.text();
    const s = sesiones(texto);
    const pista = texto.trim().slice(0, 1).match(/[{[]/) ? 'JSON' : 'HTML';
    console.log(
      `  ${etiqueta.padEnd(46)} ${res.status}  ${String(texto.length).padStart(7)}b  ${pista}  ${s.join(' ') || '-'}`
    );
    return { s, texto, status: res.status };
  } catch (e: any) {
    console.log(`  ${etiqueta.padEnd(46)} ERROR ${String(e.message).slice(0, 30)}`);
    return { s: [], texto: '', status: 0 };
  }
}

console.log(`\nFecha objetivo: ${fechaIso} (${fechaEs} / ${fechaCompacta})`);

console.log('\nREFERENCIA');
const base = await probar('base', BASE);
const sesionBase = base.s[0] ?? 'S193/20260723';

console.log('\nBUSCANDO PISTAS EN EL HTML');
const html = await descargarHtml(BASE);

const portlets = Array.from(new Set(html.match(/p_p_id=([a-zA-Z0-9_]+)/g) ?? []));
console.log('  portlets: ' + portlets.slice(0, 12).join(' '));

const resourceIds = Array.from(new Set(html.match(/p_p_resource_id=([a-zA-Z0-9_%.-]+)/g) ?? []));
console.log('  resource_id: ' + (resourceIds.slice(0, 10).join(' ') || 'ninguno en el HTML'));

const namespaces = Array.from(new Set(html.match(/_[a-z]+_INSTANCE_[a-zA-Z0-9]+/g) ?? []));
console.log('  instancias: ' + (namespaces.slice(0, 6).join(' ') || 'ninguna'));

const urlsAjax = Array.from(
  new Set(html.match(/["'](\/[a-z0-9/_.-]*(?:votacion|calendar|sesion)[a-z0-9/_.-]*)["']/gi) ?? [])
);
console.log('  rutas sospechosas: ' + (urlsAjax.slice(0, 10).join(' ') || 'ninguna'));

const lifecycle2 = Array.from(new Set(html.match(/[^"'\s]*p_p_lifecycle=2[^"'\s]*/g) ?? []));
console.log('  urls lifecycle=2: ' + (lifecycle2.length ? lifecycle2.length : 'ninguna'));
lifecycle2.slice(0, 3).forEach(u => console.log('      ' + u.slice(0, 150)));

console.log('\nENDPOINTS AJAX (lifecycle=2)');
const idsPortlet = ['votaciones', 'opendatavotaciones', 'calendariovotaciones'];
const recursos = ['votaciones', 'obtenerVotaciones', 'calendario', 'cargarVotaciones', 'sesion', ''];

for (const pid of idsPortlet) {
  for (const rec of recursos) {
    const url =
      `${BASE}?p_p_id=${pid}&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view` +
      (rec ? `&p_p_resource_id=${rec}` : '') +
      `&_${pid}_fecha=${encodeURIComponent(fechaEs)}&_${pid}_legislatura=XV`;
    const r = await probar(`${pid} / ${rec || '(sin resource)'}`, url);
    if (r.s.some(x => x !== sesionBase)) {
      console.log('\n  *** ACIERTO ***');
      console.log('  ' + url + '\n');
    }
    await new Promise(res => setTimeout(res, 500));
  }
}

console.log('\nPOST AL FORMULARIO');
for (const pid of ['votaciones']) {
  const url = `${BASE}?p_p_id=${pid}&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view`;
  const cuerpos = [
    `_${pid}_fecha=${encodeURIComponent(fechaEs)}&_${pid}_legislatura=XV`,
    `fecha=${encodeURIComponent(fechaEs)}&legislatura=XV`,
    `_${pid}_fechaSeleccionada=${fechaCompacta}`
  ];
  for (const cuerpo of cuerpos) {
    const r = await probar(`POST ${cuerpo.slice(0, 34)}`, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo
    });
    if (r.s.some(x => x !== sesionBase)) {
      console.log('\n  *** ACIERTO POST ***');
      console.log('  ' + url);
      console.log('  body: ' + cuerpo + '\n');
    }
    await new Promise(res => setTimeout(res, 500));
  }
}

console.log('\nSi todo devuelve S193, captura la peticion real con DevTools > Network > XHR.');
console.log('');

export {};
