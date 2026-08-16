import { db, exigirEnv } from '../src/lib/supabase';
import { normalizarNombre, slugificar } from '../src/lib/texto';
import { descargarHtml, extraerUrls, masReciente, BASE_CONGRESO, UA } from '../src/lib/descubrir';

const URL_LISTADO = `${BASE_CONGRESO}/es/opendata/diputados`;

const F = {
  nombreCompleto: ['NOMBRE', 'nombre', 'Nombre'],
  circunscripcion: ['CIRCUNSCRIPCION', 'circunscripcion', 'Circunscripcion'],
  formacion: ['FORMACIONELECTORAL', 'formacionElectoral', 'FORMACION'],
  grupo: ['GRUPOPARLAMENTARIO', 'grupoParlamentario', 'GRUPO'],
  alta: ['FECHAALTA', 'fechaAlta', 'FECHACONDICIONPLENA'],
  altaGrupo: ['FECHAALTAENGRUPOPARLAMENTARIO', 'fechaAltaEnGrupoParlamentario'],
  baja: ['FECHABAJA', 'fechaBaja', 'FECHACESE'],
  biografia: ['BIOGRAFIA', 'biografia']
};

const PARTIDOS_POR_FORMACION: [string, string][] = [
  ['sumar', 'sumar'],
  ['podemos', 'podemos'],
  ['izquierda unida', 'sumar'],
  ['mas madrid', 'masmadrid'],
  ['mas pais', 'sumar'],
  ['compromis', 'sumar'],
  ['chunta', 'sumar'],
  ['psoe', 'psoe'],
  ['psc', 'psoe'],
  ['psdeg', 'psoe'],
  ['pspv', 'psoe'],
  ['socialista', 'psoe'],
  ['upn', 'upn'],
  ['pp', 'pp'],
  ['popular', 'pp'],
  ['vox', 'vox'],
  ['erc', 'erc'],
  ['esquerra', 'erc'],
  ['junts', 'junts'],
  ['jxcat', 'junts'],
  ['bildu', 'bildu'],
  ['pnv', 'pnv'],
  ['eaj', 'pnv'],
  ['bng', 'bng'],
  ['cc', 'cc'],
  ['coalicion canaria', 'cc'],
  ['ciudadanos', 'ciudadanos'],
  ['cs', 'ciudadanos']
];

function leer(fila: any, candidatos: string[]): string | null {
  for (const c of candidatos) {
    const v = fila[c];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

export function partirNombre(completo: string): { apellidos: string; nombre: string } | null {
  const i = completo.indexOf(',');
  if (i > 0) {
    const apellidos = completo.slice(0, i).trim();
    const nombre = completo.slice(i + 1).trim();
    if (apellidos && nombre) return { apellidos, nombre };
  }
  const partes = completo.trim().split(/\s+/);
  if (partes.length < 2) return null;
  return { nombre: partes[0], apellidos: partes.slice(1).join(' ') };
}

export function partidoDesdeFormacion(formacion: string | null): string | null {
  if (!formacion) return null;
  const n = normalizarNombre(formacion);
  for (const [patron, slug] of PARTIDOS_POR_FORMACION) {
    if (n.includes(patron)) return slug;
  }
  return null;
}

function aIso(valor: string | null): string | null {
  if (!valor) return null;
  const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
  return null;
}

async function localizarFicheros(): Promise<{ activos: string; baja: string | null }> {
  const html = await descargarHtml(URL_LISTADO);
  const todos = extraerUrls(html, /webpublica\/opendata\/diputados\/[^"'\s<>]+\.json/);
  if (todos.length === 0) {
    throw new Error(`No se encontro ningun .json en ${URL_LISTADO}`);
  }
  const activos = masReciente(todos.filter(u => /DiputadosActivos/i.test(u)));
  const baja = masReciente(todos.filter(u => /DiputadosDeBaja/i.test(u)));
  if (!activos) {
    todos.slice(0, 15).forEach(u => console.log('   ' + u));
    throw new Error('No hay DiputadosActivos entre los ficheros listados.');
  }
  return { activos, baja };
}

async function descargarJson(url: string): Promise<any[]> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} devolvio HTTP ${res.status}`);
  const json = await res.json();
  if (Array.isArray(json)) return json;
  for (const clave of Object.keys(json)) {
    if (Array.isArray(json[clave])) return json[clave];
  }
  throw new Error(`${url}: el JSON no contiene ningun array`);
}

async function inspeccionar() {
  const { activos, baja } = await localizarFicheros();
  console.log('ACTIVOS:', activos);
  console.log('DE BAJA:', baja ?? '(no encontrado)');

  const filas = await descargarJson(activos);
  console.log('\nRegistros:', filas.length);

  console.log('\nCampos del primer registro:');
  Object.keys(filas[0]).forEach(k => {
    const v = String(filas[0][k] ?? '');
    console.log(`  ${k.padEnd(32)} ${v.length > 55 ? v.slice(0, 55) + '...' : v}`);
  });

  console.log('\nMapeo:');
  const bruto = leer(filas[0], F.nombreCompleto);
  const partido = partirNombre(bruto ?? '');
  console.log(`  nombre completo   -> ${bruto ?? 'NO DETECTADO'}`);
  console.log(`  apellidos         -> ${partido?.apellidos ?? 'NO DETECTADO'}`);
  console.log(`  nombre            -> ${partido?.nombre ?? 'NO DETECTADO'}`);
  console.log(`  circunscripcion   -> ${leer(filas[0], F.circunscripcion) ?? 'NO DETECTADO'}`);
  console.log(`  formacion         -> ${leer(filas[0], F.formacion) ?? 'NO DETECTADO'}`);
  console.log(`  grupo             -> ${leer(filas[0], F.grupo) ?? 'NO DETECTADO'}`);
  console.log(`  fecha alta        -> ${aIso(leer(filas[0], F.alta)) ?? 'NO DETECTADO'}`);

  const sinPartir = filas.filter(f => !partirNombre(leer(f, F.nombreCompleto) ?? ''));
  console.log(`\nNombres que no se pueden partir: ${sinPartir.length}`);
  sinPartir.slice(0, 10).forEach(f => console.log('  ' + leer(f, F.nombreCompleto)));

  console.log('\nGRUPOS PARLAMENTARIOS');
  const grupos = new Map<string, number>();
  filas.forEach(f => {
    const g = leer(f, F.grupo);
    if (g) grupos.set(g, (grupos.get(g) ?? 0) + 1);
  });
  Array.from(grupos.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([g, n]) => console.log(`  ${String(n).padStart(3)}  ${g}`));

  console.log('\nFORMACIONES ELECTORALES -> partido');
  const formaciones = new Map<string, number>();
  filas.forEach(f => {
    const v = leer(f, F.formacion);
    if (v) formaciones.set(v, (formaciones.get(v) ?? 0) + 1);
  });
  const sinMapear: string[] = [];
  Array.from(formaciones.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([v, n]) => {
      const slug = partidoDesdeFormacion(v);
      if (!slug) sinMapear.push(v);
      console.log(`  ${String(n).padStart(3)}  ${v.padEnd(34)} -> ${slug ?? 'SIN MAPEAR'}`);
    });

  console.log(
    sinMapear.length > 0
      ? `\nAVISO: ${sinMapear.length} formacion(es) sin mapear. Anadelas a PARTIDOS_POR_FORMACION.`
      : '\nLISTO. Ejecuta: npm run censo:cargar'
  );
}

async function cargar() {
  const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');
  const { activos, baja } = await localizarFicheros();

  const filas = [
    ...(await descargarJson(activos)).map(f => ({ ...f, __activo: true })),
    ...(baja ? (await descargarJson(baja)).map(f => ({ ...f, __activo: false })) : [])
  ];
  console.log(`Registros a procesar: ${filas.length}`);

  const { data: grupos } = await db()
    .from('grupos_parlamentarios')
    .select('id, siglas, nombre')
    .eq('legislatura_id', legislaturaId);

  const idxGrupos = new Map<string, string>();
  (grupos ?? []).forEach(g => {
    idxGrupos.set(normalizarNombre(g.siglas), g.id);
    idxGrupos.set(normalizarNombre(g.nombre), g.id);
  });

  const { data: partidos } = await db().from('partidos').select('id, slug');
  const idxPartidos = new Map<string, string>();
  (partidos ?? []).forEach(p => idxPartidos.set(p.slug, p.id));

  let insertados = 0;
  let conPartido = 0;
  const gruposHuerfanos = new Map<string, number>();
  const formacionesHuerfanas = new Map<string, number>();
  const nombresRotos: string[] = [];

  for (const fila of filas) {
    const bruto = leer(fila, F.nombreCompleto);
    const partes = bruto ? partirNombre(bruto) : null;
    if (!partes) {
      if (bruto) nombresRotos.push(bruto);
      continue;
    }

    const { apellidos, nombre } = partes;
    const slug = slugificar(apellidos, nombre);

    const { data: politico, error } = await db()
      .from('politicos')
      .upsert({ slug, nombre, apellidos }, { onConflict: 'slug' })
      .select('id')
      .single();

    if (error) {
      console.error(`  ERROR ${bruto}: ${error.message}`);
      continue;
    }

    await db().from('alias_diputados').upsert(
      {
        politico_id: politico.id,
        alias_normalizado: normalizarNombre(bruto!),
        origen: 'censo_oficial'
      },
      { onConflict: 'alias_normalizado' }
    );

    const grupoTexto = leer(fila, F.grupo);
    const grupoId = grupoTexto ? idxGrupos.get(normalizarNombre(grupoTexto)) ?? null : null;
    if (grupoTexto && !grupoId) {
      gruposHuerfanos.set(grupoTexto, (gruposHuerfanos.get(grupoTexto) ?? 0) + 1);
    }

    const formacion = leer(fila, F.formacion);
    const partidoSlug = partidoDesdeFormacion(formacion);
    const partidoId = partidoSlug ? idxPartidos.get(partidoSlug) ?? null : null;
    if (formacion && !partidoSlug) {
      formacionesHuerfanas.set(formacion, (formacionesHuerfanas.get(formacion) ?? 0) + 1);
    }
    if (partidoId) conPartido++;

    const { error: errMandato } = await db().from('mandatos').upsert(
      {
        politico_id: politico.id,
        legislatura_id: legislaturaId,
        grupo_id: grupoId,
        partido_id: partidoId,
        partido_efectivo_id: partidoId,
        partido_confirmado: partidoId !== null,
        circunscripcion: leer(fila, F.circunscripcion),
        id_externo: slug,
        fecha_alta: aIso(leer(fila, F.alta)) ?? '2023-08-17',
        fecha_baja: fila.__activo ? null : aIso(leer(fila, F.baja))
      },
      { onConflict: 'legislatura_id,id_externo' }
    );

    if (errMandato) {
      console.error(`  ERROR mandato ${bruto}: ${errMandato.message}`);
      continue;
    }

    insertados++;
  }

  console.log(`\nMandatos cargados: ${insertados}`);
  console.log(`Con partido asignado: ${conPartido}`);

  if (nombresRotos.length > 0) {
    console.log(`\nNombres no interpretables: ${nombresRotos.length}`);
    nombresRotos.slice(0, 10).forEach(n => console.log('  ' + n));
  }

  if (gruposHuerfanos.size > 0) {
    console.log('\nGRUPOS que no casan con grupos_parlamentarios:');
    gruposHuerfanos.forEach((n, g) => console.log(`  ${String(n).padStart(3)}  ${g}`));
  }

  if (formacionesHuerfanas.size > 0) {
    console.log('\nFORMACIONES sin mapear a partido:');
    formacionesHuerfanas.forEach((n, f) => console.log(`  ${String(n).padStart(3)}  ${f}`));
  }

  if (insertados === 0) {
    console.error('\nFALLO: no se inserto ningun mandato. Revisa los nombres de campo.');
    process.exit(1);
  }

  console.log('\nSIGUIENTE: npm run ingesta:local');
}

const modo = process.argv.includes('--inspeccionar') ? 'inspeccionar' : 'cargar';
(modo === 'inspeccionar' ? inspeccionar() : cargar()).catch(e => {
  console.error('\n' + String(e?.message ?? e) + '\n');
  process.exit(1);
});