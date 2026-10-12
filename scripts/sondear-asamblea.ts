import { getDocumentProxy, extractText } from 'unpdf';
import { UA } from '../src/lib/descubrir';

const avisoOriginal = console.warn;
console.warn = (...a: any[]) => { if (!/glyf|TT:|undefined function/i.test(String(a[0] ?? ''))) avisoOriginal(...a); };

const BASE = 'https://www.asambleamadrid.es';
const ESPERA_MS = 25000;

const PAGINAS = [
  `${BASE}/composicion/diputados/regimen-economico-social/lista-general-bienes`,
  `${BASE}/diputados`,
  `${BASE}/organos/pleno/informacion-pleno`,
  `${BASE}/servicios/datos-abiertos`,
  `${BASE}/ES/OpenData/Paginas/Default.aspx`,
  `${BASE}/transparencia`
];

const CLAVES = /bien|declara|inter[eé]s|actividad|incompatib|retribu|votaci|voto|diario|sesi[oó]n|pleno|opendata|datos-abiertos|datos abiertos|iniciativ|boam|ley|\.pdf|\.json|\.csv|\.xml|\.xlsx?|rss|api/i;

interface Pagina {
  url: string;
  final: string;
  estado: number;
  tipo: string;
  bytes: number;
  cuerpo: string;
}

const galletas = new Map<string, string>();

function guardarGalletas(res: Response) {
  const lista = typeof (res.headers as any).getSetCookie === 'function' ? (res.headers as any).getSetCookie() as string[] : [];
  for (const g of lista) {
    const par = g.split(';')[0];
    const i = par.indexOf('=');
    if (i > 0) galletas.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
}

function cabeceraGalletas(): string {
  return Array.from(galletas, ([k, v]) => `${k}=${v}`).join('; ');
}

async function bajar(url: string): Promise<Pagina | null> {
  let actual = url;
  try {
    for (let salto = 0; salto < 8; salto++) {
      const res = await fetch(actual, {
        redirect: 'manual',
        signal: AbortSignal.timeout(ESPERA_MS),
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          ...(galletas.size ? { Cookie: cabeceraGalletas() } : {})
        }
      });
      guardarGalletas(res);
      const destino = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && destino) {
        console.log(`  ${res.status} -> ${destino}`);
        actual = new URL(destino, actual).href;
        continue;
      }
      const cuerpo = await res.text();
      if (res.status >= 300 || /being redirected/i.test(cuerpo)) {
        console.log(`  respuesta ${res.status} sin destino. Cabeceras:`);
        res.headers.forEach((v, k) => console.log(`    ${k}: ${k === 'set-cookie' ? v.replace(/=[^;,]+/g, '=…') : v.slice(0, 160)}`));
        console.log('  cuerpo:');
        console.log(cuerpo.slice(0, 1500).split('\n').map(l => '    ' + l).join('\n'));
        const js = cuerpo.match(/(?:location(?:\.href)?\s*=|location\.replace\(|http-equiv=["']?refresh["']?[^>]*url=)\s*["']?([^"' >)]+)/i)?.[1];
        if (js && salto < 7) {
          console.log(`  el cuerpo manda a ${js}; lo sigo con las galletas recibidas`);
          actual = new URL(js, actual).href;
          continue;
        }
      }
      return { url, final: actual, estado: res.status, tipo: res.headers.get('content-type') ?? '', bytes: cuerpo.length, cuerpo };
    }
    console.log(`  demasiadas redirecciones desde ${url}`);
    return null;
  } catch (e: any) {
    console.log(`  ERROR ${actual}: ${e?.message ?? e}${e?.cause ? ` (${e.cause?.code ?? e.cause?.message ?? e.cause})` : ''}`);
    return null;
  }
}

function titulo(html: string): string {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
}

function enlaces(html: string, base: string): { url: string; texto: string }[] {
  const vistos = new Map<string, string>();
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let url: string;
    try { url = new URL(m[1], base).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    const texto = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!vistos.has(url)) vistos.set(url, texto);
  }
  return Array.from(vistos, ([url, texto]) => ({ url, texto }));
}

function extension(url: string): string {
  const ruta = url.split('?')[0].toLowerCase();
  const m = ruta.match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : 'html';
}

function resumir(p: Pagina) {
  console.log(`  estado ${p.estado}  tipo ${p.tipo}  ${(p.bytes / 1024).toFixed(0)} KB`);
  if (p.final !== p.url) console.log(`  redirige a ${p.final}`);
  console.log(`  titulo: ${titulo(p.cuerpo) || '(sin titulo)'}`);
  const todos = enlaces(p.cuerpo, p.final);
  const porTipo = new Map<string, number>();
  todos.forEach(e => porTipo.set(extension(e.url), (porTipo.get(extension(e.url)) ?? 0) + 1));
  console.log(`  enlaces: ${todos.length}  (${Array.from(porTipo, ([k, n]) => `${k} ${n}`).join(', ')})`);
  const utiles = todos.filter(e => CLAVES.test(e.url) || CLAVES.test(e.texto));
  console.log(`  enlaces que importan: ${utiles.length}`);
  utiles.slice(0, 60).forEach(e => console.log(`    ${e.texto.slice(0, 60).padEnd(62)} ${e.url}`));
  if (utiles.length > 60) console.log(`    ... y ${utiles.length - 60} mas`);
  const scripts = Array.from(p.cuerpo.matchAll(/["'](\/[^"'\s]*(?:api|json|ajax|servicio|rest)[^"'\s]*)["']/gi)).map(m => m[1]);
  if (scripts.length) console.log(`  rutas de datos dentro del HTML: ${Array.from(new Set(scripts)).slice(0, 15).join('  ')}`);
  return todos;
}

async function leerPdf(url: string) {
  console.log(`\n  PDF ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS), headers: { 'User-Agent': UA } });
    const buf = new Uint8Array(await res.arrayBuffer());
    console.log(`  HTTP ${res.status}  ${(buf.length / 1024).toFixed(0)} KB`);
    if (String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') {
      console.log('  No es un PDF.');
      return;
    }
    const pdf = await getDocumentProxy(buf);
    let campos: any = null;
    try { campos = await (pdf as any).getFieldObjects(); } catch {}
    const nCampos = campos ? Object.keys(campos).length : 0;
    console.log(`  campos de formulario: ${nCampos}`);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const limpio = text.replace(/[ \t]+/g, ' ').trim();
    console.log(`  paginas ${totalPages}  caracteres de texto ${limpio.length}${limpio.length < 200 ? '  (casi sin texto: probablemente escaneado)' : ''}`);
    const importes = limpio.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) ?? [];
    console.log(`  importes detectados: ${importes.length}`);
    ['BIENES', 'INMUEBLE', 'URBANO', 'R[UÚ]STICO', 'MUNICIPIO', 'PROVINCIA', 'DEP[OÓ]SITO', 'VALORES', 'ACCIONES', 'VEH[IÍ]CULO', 'DEUDA', 'PR[EÉ]STAMO', 'PENSIONES', 'RENTA', 'ACTIVIDAD']
      .forEach(s => { if (new RegExp(s, 'i').test(limpio)) console.log(`    contiene ${s}`); });
    console.log('\n  primeros 1500 caracteres:\n');
    console.log(limpio.slice(0, 1500).split('\n').map(l => '    ' + l).join('\n'));
  } catch (e: any) {
    console.log(`  ERROR ${e?.message ?? e}`);
  }
}

console.log(`\nSONDEO ASAMBLEA DE MADRID  ${new Date().toISOString()}\n`);

const resultados = new Map<string, { url: string; texto: string }[]>();

for (const url of PAGINAS) {
  console.log(`\n=== ${url}`);
  const p = await bajar(url);
  if (p) resultados.set(url, resumir(p));
}

const bienes = resultados.get(PAGINAS[0]) ?? [];
const pdfsBienes = bienes.filter(e => extension(e.url) === 'pdf');
console.log(`\n\n=== DECLARACIONES: ${pdfsBienes.length} PDF en la lista general de bienes`);
pdfsBienes.slice(0, 12).forEach(e => console.log(`  ${e.texto.slice(0, 60).padEnd(62)} ${e.url}`));
if (pdfsBienes.length) {
  await leerPdf(pdfsBienes[0].url);
  if (pdfsBienes.length > 1) await leerPdf(pdfsBienes[Math.floor(pdfsBienes.length / 2)].url);
}

const diputados = (resultados.get(PAGINAS[1]) ?? []).filter(e => /\/diputados\/[^/?#]+/i.test(e.url) && !/regimen|lista|composicion\/?$/i.test(e.url));
console.log(`\n\n=== FICHAS: ${diputados.length} enlaces con pinta de ficha de diputado`);
diputados.slice(0, 10).forEach(e => console.log(`  ${e.texto.slice(0, 60).padEnd(62)} ${e.url}`));
for (const ficha of diputados.slice(0, 2)) {
  console.log(`\n=== FICHA ${ficha.url}`);
  const p = await bajar(ficha.url);
  if (p) resumir(p);
}

console.log('\nFIN. Pega toda esta salida en el chat.\n');

export {};