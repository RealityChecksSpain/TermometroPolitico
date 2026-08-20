import { db, exigirEnv } from '../src/lib/supabase';
import { normalizarNombre } from '../src/lib/texto';
import { UA, BASE_CONGRESO } from '../src/lib/descubrir';

exigirEnv('LEGISLATURA_ACTIVA_ID');
const legislaturaId = process.env.LEGISLATURA_ACTIVA_ID!;
const LEG = process.env.LEG_INT ?? '15';
const DESDE = Number(process.argv[2] ?? 1);
const HASTA = Number(process.argv[3] ?? 450);
const PAUSA = 550;

function urlFicha(cod: number) {
  return `${BASE_CONGRESO}/es/busqueda-de-diputados?p_p_id=diputadomodule&p_p_lifecycle=2` +
    `&p_p_state=normal&p_p_mode=view&p_p_resource_id=agendaDiputados` +
    `&p_p_cacheability=cacheLevelPage&_diputadomodule_mostrarAgenda=false` +
    `&_diputadomodule_idLegislatura=XV&_diputadomodule_mostrarFicha=true` +
    `&_diputadomodule_codParlamentario=${cod}`;
}

function urlPublica(cod: number) {
  return `${BASE_CONGRESO}/es/busqueda-de-diputados?p_p_id=diputadomodule&p_p_lifecycle=0` +
    `&p_p_state=normal&p_p_mode=view&_diputadomodule_mostrarFicha=true` +
    `&codParlamentario=${cod}&idLegislatura=XV&mostrarAgenda=false`;
}

function limpiar(t: string) {
  return t.replace(/&nbsp;/g, ' ').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ').replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í').replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

function extraer(html: string, cod: number) {
  const t = limpiar(html);

  const foto = t.match(/\/docu\/imgweb\/diputados\/(\d+)_(\d+)\.(jpg|jpeg|png)/i);
  const tituloPagina = t.match(/<title[^>]*>\s*([^<]{4,120})\s*<\/title>/i)?.[1] ?? '';
  const bienes = Array.from(new Set(t.match(/\/docbienes\/leg\d+\/\d+\/[^"'\s<>]+\.pdf/gi) ?? []));
  const acteco = Array.from(new Set(t.match(/\/docu\/[a-z0-9/_.-]*acteco[^"'\s<>]*\.pdf/gi) ?? []));
  const email = t.match(/([a-z0-9._%-]+@congreso\.es)/i);

  let nombre: string | null = null;
  const titulos = [
    /<h2[^>]*>\s*([^<]{6,80})\s*<\/h2>/i,
    /<h3[^>]*>\s*([^<]{6,80})\s*<\/h3>/i,
    /class="[^"]*nombre[^"]*"[^>]*>\s*([^<]{6,80})\s*</i,
    /alt="([^"]{6,60})"\s+[^>]*imgweb/i
  ];
  for (const p of titulos) {
    const m = t.match(p);
    const v = m?.[1]?.trim();
    if (v && /,/.test(v) && !/congreso|diputad|legislatura|card image/i.test(v)) { nombre = v; break; }
  }
  if (!nombre) {
    const m = t.match(/>\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ'-]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ'-]+){0,4},\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ'.\s-]{2,40})\s*</);
    if (m) nombre = m[1].trim();
  }
  if (!nombre && /,/.test(tituloPagina)) {
    const limpio = tituloPagina.replace(/\s*[-|·]\s*Congreso.*/i, '').trim();
    if (limpio.length > 6 && limpio.length < 80) nombre = limpio;
  }

  return {
    nombre,
    foto: foto ? BASE_CONGRESO + foto[0] : null,
    codFoto: foto ? Number(foto[1]) : null,
    bienes: bienes.length ? BASE_CONGRESO + bienes[bienes.length - 1] : null,
    actividades: acteco.length ? BASE_CONGRESO + acteco[acteco.length - 1] : null,
    email: email ? email[1] : null,
    ficha: urlPublica(cod)
  };
}

let cookies = '';

async function abrirSesion() {
  const r = await fetch(`${BASE_CONGRESO}/es/busqueda-de-diputados`, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }
  });
  const crudas = (r.headers as any).getSetCookie?.() ?? [];
  const lista = crudas.length ? crudas : [r.headers.get('set-cookie')].filter(Boolean);
  cookies = lista.map((c: string) => String(c).split(';')[0]).join('; ');
  if (!cookies.includes('GUEST_LANGUAGE_ID')) {
    cookies += (cookies ? '; ' : '') + 'GUEST_LANGUAGE_ID=es_ES; COOKIE_SUPPORT=true';
  }
  return cookies;
}

console.log('\nAbriendo sesion...');
await abrirSesion();
console.log(`  cookies: ${cookies ? cookies.slice(0, 70) + '…' : 'NINGUNA'}`);

async function pedirFicha(cod: number, reintentado = false): Promise<string> {
  const r = await fetch(urlPublica(cod), {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
      Referer: `${BASE_CONGRESO}/es/busqueda-de-diputados`,
      Cookie: cookies
    }
  });

  const t = await r.text();
  if ((!r.ok || t.length < 2000) && !reintentado) {
    await abrirSesion();
    return pedirFicha(cod, true);
  }
  return t;
}

console.log(`\nRecorriendo fichas del ${DESDE} al ${HASTA}\n`);

let conNombre = 0, vacias = 0, asignadas = 0, sinCruce = 0;
const noCruzan: string[] = [];

for (let cod = DESDE; cod <= HASTA; cod++) {
  let html = '';
  try {
    html = await pedirFicha(cod);
  } catch {
    vacias++;
    await new Promise(res => setTimeout(res, PAUSA));
    continue;
  }

  if (cod === DESDE) {
    const t = limpiar(html);
    console.log(`  respuesta de muestra: ${html.length} caracteres`);
    console.log(`  foto encontrada: ${/imgweb\/diputados/i.test(t) ? 'SI' : 'NO'}`);
    console.log(`  docbienes: ${(t.match(/docbienes/gi) ?? []).length}`);
    const nom = t.match(/<h2[^>]*>\s*([^<]{6,80})\s*<\/h2>/i)?.[1]
      ?? t.match(/<h3[^>]*>\s*([^<]{6,80})\s*<\/h3>/i)?.[1];
    console.log(`  titular: ${nom ?? '(no detectado)'}`);
    console.log('');
  }

  if (!/imgweb\/diputados/i.test(html)) { vacias++; await new Promise(res => setTimeout(res, PAUSA)); continue; }

  const d = extraer(html, cod);
  if (!d.nombre) { vacias++; await new Promise(res => setTimeout(res, PAUSA)); continue; }
  conNombre++;

  const { data: cand } = await db().rpc('resolver_nombre', {
    p_nombre: d.nombre, p_legislatura_id: legislaturaId,
    p_umbral_auto: 0.6, p_umbral_candidato: 0.45
  });
  const mejor = Array.isArray(cand) ? cand[0] : null;

  if (!mejor || Number(mejor.similitud) < 0.5) {
    sinCruce++;
    if (noCruzan.length < 25) noCruzan.push(`${cod}: ${d.nombre}`);
    await new Promise(res => setTimeout(res, PAUSA));
    continue;
  }

  const { error } = await db().from('mandatos').update({
    cod_parlamentario: cod,
    foto_url: d.foto,
    url_ficha: d.ficha,
    url_bienes: d.bienes,
    url_actividades: d.actividades,
    email: d.email
  }).eq('id', mejor.mandato_id);

  if (!error) asignadas++;

  if (asignadas % 25 === 0 && asignadas > 0) {
    console.log(`  [${String(cod).padStart(3)}] ${asignadas} asignadas · ultimo: ${String(mejor.nombre_completo).slice(0, 40)}`);
  }

  await new Promise(res => setTimeout(res, PAUSA));
}

console.log('\nRESULTADO');
console.log(`  fichas con nombre:  ${conNombre}`);
console.log(`  vacias o sin datos: ${vacias}`);
console.log(`  asignadas:          ${asignadas}`);
console.log(`  sin cruzar:         ${sinCruce}`);

if (noCruzan.length) {
  console.log('\n  NOMBRES QUE NO CRUZAN (probablemente de otras legislaturas)');
  noCruzan.forEach(n => console.log('    ' + n));
}

const { count: conFoto } = await db().from('mandatos')
  .select('id', { count: 'exact', head: true })
  .eq('legislatura_id', legislaturaId).not('foto_url', 'is', null);
const { count: conBienes } = await db().from('mandatos')
  .select('id', { count: 'exact', head: true })
  .eq('legislatura_id', legislaturaId).not('url_bienes', 'is', null);

console.log(`\n  con foto:   ${conFoto ?? 0}`);
console.log(`  con bienes: ${conBienes ?? 0}`);

await db().rpc('refrescar_metricas');
console.log('\n  Metricas refrescadas.\n');

export {};