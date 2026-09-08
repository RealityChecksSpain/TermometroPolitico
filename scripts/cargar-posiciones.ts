import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { traerTodo } from '../src/lib/paginar';
import {
  EJES, EjeId, ESQUEMAS, FUENTES, POLOS,
  anioDe, normalizarA10, normalizarTexto, primeraColumna
} from '../src/lib/escalas';
import { decodificarPais } from '../src/lib/paises-ches';

exigirEnv('SUPABASE_URL');
exigirEnv('SUPABASE_SERVICE_ROLE_KEY');

const args = process.argv.slice(2);

function opcion(nombre: string): string | null {
  const i = args.indexOf(`--${nombre}`);
  if (i < 0) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
}

function opciones(nombre: string): string[] {
  const salida: string[] = [];
  args.forEach((a, i) => {
    if (a !== `--${nombre}`) return;
    const v = args[i + 1];
    if (v && !v.startsWith('--')) salida.push(v);
  });
  return salida;
}

function bandera(nombre: string): boolean {
  return args.includes(`--${nombre}`);
}

const FICHERO_POR_DEFECTO: Record<string, string> = {
  ches: 'datos/externas/ches.csv',
  vparty: 'datos/externas/vparty.csv',
  marpor: 'datos/externas/marpor.csv'
};

const RUTA_ENLACES = 'datos/externas/enlace-partidos.csv';
const RUTA_PROPUESTA = 'datos/externas/enlace-partidos.propuesta.csv';

function detectarDelimitador(linea: string): string {
  const candidatos = [',', ';', '\t', '|'];
  let mejor = ',';
  let max = -1;
  for (const d of candidatos) {
    let cuenta = 0;
    let comillas = false;
    for (const c of linea) {
      if (c === '"') comillas = !comillas;
      else if (c === d && !comillas) cuenta++;
    }
    if (cuenta > max) {
      max = cuenta;
      mejor = d;
    }
  }
  return mejor;
}

function partirCSV(texto: string, delimitador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  const limpio = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          comillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') {
      comillas = true;
    } else if (c === delimitador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      campo = '';
      filas.push(fila);
      fila = [];
    } else if (c !== '\r') {
      campo += c;
    }
  }
  if (campo.length || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter(f => f.some(v => v.trim() !== ''));
}

function leerTabla(ruta: string): { cabeceras: string[]; filas: Record<string, string>[] } {
  if (!existsSync(ruta)) {
    console.error(`\nNo existe el fichero ${ruta}.`);
    console.error('Descarga el dataset de su fuente oficial y guardalo en esa ruta,');
    console.error('o pasa otra con --fichero ruta/al/fichero.csv\n');
    process.exit(1);
  }
  const texto = readFileSync(ruta, 'utf8');
  const primeraLinea = texto.split('\n', 1)[0] ?? '';
  const delimitador = detectarDelimitador(primeraLinea);
  const crudo = partirCSV(texto, delimitador);
  if (!crudo.length) {
    console.error(`\nEl fichero ${ruta} no tiene filas legibles.\n`);
    process.exit(1);
  }
  const cabeceras = crudo[0].map(c => c.trim());
  const filas = crudo.slice(1).map(f => {
    const obj: Record<string, string> = {};
    cabeceras.forEach((c, i) => { obj[c] = (f[i] ?? '').trim(); });
    return obj;
  });
  return { cabeceras, filas };
}

function numero(v: string): number | null {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function estado() {
  const { data, error } = await db().from('v_cobertura_externas').select('*');
  if (error) throw error;
  console.log('\n=== Posiciones externas cargadas ===\n');
  if (!data?.length) {
    console.log('  Nada cargado todavia.\n');
    return;
  }
  for (const f of data as any[]) {
    console.log(
      `  ${String(f.fuente_id).padEnd(8)} ${String(f.eje).padEnd(12)} ` +
      `publicadas ${String(f.publicadas).padStart(5)}  ` +
      `sin verificar ${String(f.sin_verificar).padStart(5)}  ` +
      `entidades ${String(f.entidades).padStart(5)}  ` +
      `${f.anio_min}-${f.anio_max}`
    );
  }
  console.log('');
}

async function verificar() {
  const fuente = opcion('fuente');
  let consulta = db().from('v_posiciones_auditoria').select('*');
  if (fuente) consulta = consulta.eq('fuente_id', fuente);
  const filas = await traerTodo<any>((a, b) => consulta.range(a, b));

  if (!filas.length) {
    console.log('\nNo hay posiciones cargadas para verificar.\n');
    return;
  }

  const grupos = new Map<string, any[]>();
  for (const f of filas) {
    const k = `${f.fuente_id}|${f.eje}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(f);
  }

  console.log('\n=== Verificacion de polos ===');
  console.log('Comprueba que los extremos son los que esperas ANTES de publicar.');
  console.log('Si estan invertidos, corrige la orientacion en src/lib/escalas.ts y recarga.\n');

  for (const [k, lista] of Array.from(grupos.entries()).sort()) {
    const [fuenteId, eje] = k.split('|');
    const polos = POLOS[eje as EjeId] ?? ['bajo', 'alto'];
    const ordenado = [...lista].sort((a, b) => a.valor - b.valor);
    console.log(`--- ${fuenteId} / ${eje} (${lista.length} posiciones, ${lista.filter(f => f.publicado).length} publicadas)`);
    console.log(`  valor 0 deberia ser ${polos[0].toUpperCase()}:`);
    for (const f of ordenado.slice(0, 8)) {
      console.log(`    ${f.valor.toFixed(2).padStart(6)}  ${String(f.nombre_corto || f.nombre).slice(0, 34).padEnd(36)} ${f.pais_nombre ?? ''} ${f.anio}`);
    }
    console.log(`  valor 10 deberia ser ${polos[1].toUpperCase()}:`);
    for (const f of ordenado.slice(-8).reverse()) {
      console.log(`    ${f.valor.toFixed(2).padStart(6)}  ${String(f.nombre_corto || f.nombre).slice(0, 34).padEnd(36)} ${f.pais_nombre ?? ''} ${f.anio}`);
    }
    console.log('');
  }
}

async function publicar() {
  const fuente = opcion('fuente');
  const eje = opcion('eje');
  if (!fuente) {
    console.error('\nFalta --fuente. Ejemplo: npm run posiciones:publicar -- --fuente ches --eje izq_der\n');
    process.exit(1);
  }
  let actualizacion = db().from('posiciones_externas').update({ publicado: true }).eq('fuente_id', fuente);
  if (eje) actualizacion = actualizacion.eq('eje', eje);
  const { error } = await actualizacion;
  if (error) throw error;

  let recuento = db()
    .from('posiciones_externas')
    .select('id', { count: 'exact', head: true })
    .eq('fuente_id', fuente)
    .eq('publicado', true);
  if (eje) recuento = recuento.eq('eje', eje);
  const { count, error: eCuenta } = await recuento;
  if (eCuenta) throw eCuenta;

  console.log(`\nPublicadas ${count ?? 0} posiciones de ${fuente}${eje ? ` / ${eje}` : ''}.\n`);
}

async function proponerEnlaces() {
  const pais = opcion('pais');
  const entidades = await traerTodo<any>((a, b) =>
    db().from('entidades_externas').select('clave, nombre, nombre_corto, pais_nombre, partido_slug').range(a, b));
  const partidos = await traerTodo<any>((a, b) =>
    db().from('partidos').select('slug, siglas, nombre').range(a, b));

  const porSiglas = new Map<string, string>();
  const porNombre = new Map<string, string>();
  for (const p of partidos) {
    if (p.siglas) porSiglas.set(normalizarTexto(p.siglas), p.slug);
    if (p.nombre) porNombre.set(normalizarTexto(p.nombre), p.slug);
    porNombre.set(normalizarTexto(p.slug), p.slug);
  }

  const candidatas = pais
    ? entidades.filter(e => normalizarTexto(e.pais_nombre ?? '') === normalizarTexto(pais))
    : entidades;

  const lineas = ['clave,pais,nombre,nombre_corto,slug_propuesto,confianza'];
  let automaticas = 0;
  let vacias = 0;
  for (const e of candidatas) {
    const porCorto = porSiglas.get(normalizarTexto(e.nombre_corto ?? ''));
    const porLargo = porNombre.get(normalizarTexto(e.nombre ?? ''));
    const slug = porCorto ?? porLargo ?? '';
    if (!slug && !pais) continue;
    if (slug) automaticas++;
    else vacias++;
    lineas.push([
      e.clave,
      JSON.stringify(e.pais_nombre ?? ''),
      JSON.stringify(e.nombre ?? ''),
      JSON.stringify(e.nombre_corto ?? ''),
      slug,
      slug ? (porCorto ? 'siglas' : 'nombre') : 'rellenar'
    ].join(','));
  }

  mkdirSync(dirname(RUTA_PROPUESTA), { recursive: true });
  writeFileSync(RUTA_PROPUESTA, lineas.join('\n') + '\n', 'utf8');

  if (pais) {
    console.log(`\n${candidatas.length} entidades de ${pais}: ${automaticas} enlazadas automaticamente, ${vacias} por rellenar.`);
    console.log('Slugs disponibles en tu base:');
    const usados = new Set(lineas.slice(1).map(l => l.split(',').slice(-2)[0]).filter(Boolean));
    const libres = partidos.map((p: any) => p.slug).filter((sl: string) => !usados.has(sl)).sort();
    console.log('  ' + (libres.length ? libres.join(', ') : '(todos enlazados)'));
  } else {
    console.log(`\n${candidatas.length} entidades revisadas, ${automaticas} con slug propuesto.`);
  }
  console.log(`Escrito ${RUTA_PROPUESTA}`);
  console.log('Revisa a mano, rellena o borra lo que haga falta, renombralo a');
  console.log(`${RUTA_ENLACES} y vuelve a ejecutar la carga.\n`);
}

function leerEnlaces(): Map<string, string> {
  const m = new Map<string, string>();
  if (!existsSync(RUTA_ENLACES)) return m;
  const { filas } = leerTabla(RUTA_ENLACES);
  for (const f of filas) {
    const clave = f.clave ?? f.Clave;
    const slug = (f.slug ?? f.slug_propuesto ?? '').trim();
    if (clave && slug) m.set(clave, slug);
  }
  return m;
}

interface MedidaCalculada {
  eje: EjeId;
  valorBruto: number;
  escalaMin: number;
  escalaMax: number;
  orientacion: 1 | -1;
  columnas: string[];
}

async function cargar() {
  const fuenteId = opcion('fuente');
  if (!fuenteId || !ESQUEMAS[fuenteId]) {
    console.error(`\nUsa --fuente con uno de: ${Object.keys(ESQUEMAS).join(', ')}\n`);
    process.exit(1);
  }

  const esquema = ESQUEMAS[fuenteId];
  const meta = FUENTES[fuenteId];
  const ruta = opcion('fichero') || FICHERO_POR_DEFECTO[fuenteId];
  const ola = opcion('ola') || '';
  const seco = bandera('seco');
  const todosLosAnios = bandera('todos-los-anios');
  const desde = Number(opcion('desde') ?? '') || null;
  const paisFijo = opcion('pais-nombre') || '';
  const paises = (opcion('paises') || '')
    .split(',')
    .map(p => normalizarTexto(p))
    .filter(Boolean);
  const filtros = opciones('filtro')
    .map(f => {
      const i = f.indexOf('=');
      return i < 0 ? null : { columna: f.slice(0, i).trim(), valor: f.slice(i + 1).trim() };
    })
    .filter(Boolean) as { columna: string; valor: string }[];

  const { cabeceras, filas } = leerTabla(ruta);
  console.log(`\nFuente:   ${meta.nombre}`);
  console.log(`Fichero:  ${ruta}`);
  console.log(`Filas:    ${filas.length}`);
  console.log(`Columnas: ${cabeceras.length}`);

  const inspeccionar = opcion('inspeccionar');
  if (inspeccionar !== null) {
    const columna = primeraColumna(cabeceras, [inspeccionar]);
    if (!columna) {
      console.error(`\nNo existe la columna "${inspeccionar}".`);
      console.error('Columnas disponibles:\n  ' + cabeceras.join(', ') + '\n');
      process.exit(1);
    }
    const colEtiqueta = primeraColumna(cabeceras, esquema.nombreCorto) ?? primeraColumna(cabeceras, esquema.nombre);
    const cuenta = new Map<string, { n: number; ejemplos: string[] }>();
    for (const f of filas) {
      const v = f[columna] ?? '';
      if (!cuenta.has(v)) cuenta.set(v, { n: 0, ejemplos: [] });
      const c = cuenta.get(v)!;
      c.n++;
      const etiqueta = colEtiqueta ? (f[colEtiqueta] ?? '') : '';
      if (etiqueta && c.ejemplos.length < 4 && !c.ejemplos.includes(etiqueta)) c.ejemplos.push(etiqueta);
    }
    console.log(`\nValores distintos de "${columna}": ${cuenta.size}\n`);
    for (const [v, c] of Array.from(cuenta.entries()).sort((a, b) => b[1].n - a[1].n)) {
      console.log(`  ${String(v).padEnd(10)} ${String(c.n).padStart(6)} filas   ${c.ejemplos.join(', ')}`);
    }
    console.log('');
    return;
  }

  const colPais = primeraColumna(cabeceras, esquema.pais);
  const colNombre = primeraColumna(cabeceras, esquema.nombre);
  const colCorto = primeraColumna(cabeceras, esquema.nombreCorto);
  const colAnio = primeraColumna(cabeceras, esquema.anio);
  const colPf = primeraColumna(cabeceras, ['pf_party_id']);
  const colId = colPf ?? primeraColumna(cabeceras, esquema.idCompartido.filter(c => c !== 'pf_party_id'));

  const faltan: string[] = [];
  if (!colPais) faltan.push(`pais (probadas: ${esquema.pais.join(', ')})`);
  if (!colNombre) faltan.push(`nombre (probadas: ${esquema.nombre.join(', ')})`);
  if (!colAnio) faltan.push(`anio (probadas: ${esquema.anio.join(', ')})`);

  const medidasResueltas: { eje: EjeId; columnas: { nombre: string; orientacion: 1 | -1 }[]; escalaMin: number; escalaMax: number; minimoPresentes: number }[] = [];
  for (const eje of EJES) {
    const medida = esquema.medidas[eje];
    if (!medida) continue;
    const presentes = medida.columnas
      .map(c => ({ ...c, nombre: primeraColumna(cabeceras, [c.nombre]) ?? '' }))
      .filter(c => c.nombre);
    if (presentes.length < medida.minimoPresentes) {
      faltan.push(`${eje} (necesita ${medida.minimoPresentes} de: ${medida.columnas.map(c => c.nombre).join(', ')}, encontradas ${presentes.length})`);
      continue;
    }
    medidasResueltas.push({
      eje,
      columnas: presentes as { nombre: string; orientacion: 1 | -1 }[],
      escalaMin: medida.escalaMin,
      escalaMax: medida.escalaMax,
      minimoPresentes: medida.minimoPresentes
    });
  }

  if (faltan.length) {
    console.error('\nColumnas que no aparecen en el fichero:');
    faltan.forEach(f => console.error(`  - ${f}`));
    console.error('\nColumnas disponibles:');
    console.error('  ' + cabeceras.join(', '));
    console.error('\nAjusta ESQUEMAS en src/lib/escalas.ts contra el codebook de tu ola.\n');
    if (!medidasResueltas.length) process.exit(1);
  }

  console.log(`Clave:    ${colId ? colId : 'nombre + pais'}`);
  console.log(`Ejes:     ${medidasResueltas.map(m => `${m.eje} (${m.columnas.map(c => c.nombre).join('+')})`).join(', ')}\n`);

  interface Registro {
    clave: string;
    nombre: string;
    nombreCorto: string;
    pais: string;
    paisCodigo: string | null;
    anio: number;
    medidas: MedidaCalculada[];
  }

  const registros = new Map<string, Registro>();
  let sinAnio = 0;
  let sinMedida = 0;
  let fueraDePais = 0;
  let fueraDeHorizonte = 0;

  for (const fila of filas) {
    if (filtros.length && !filtros.every(f => (fila[f.columna] ?? '').trim() === f.valor)) {
      fueraDePais++;
      continue;
    }
    const paisCrudo = fila[colPais!] ?? '';
    const decodificado = decodificarPais(fuenteId, paisCrudo);
    const pais = paisFijo || decodificado.nombre;
    if (paises.length && !paises.some(p => normalizarTexto(pais).includes(p))) {
      fueraDePais++;
      continue;
    }
    const anio = anioDe(fila[colAnio!] ?? '');
    if (anio === null) {
      sinAnio++;
      continue;
    }
    if (desde !== null && anio < desde) {
      fueraDeHorizonte++;
      continue;
    }
    const nombre = (fila[colNombre!] ?? '').trim();
    if (!nombre) continue;
    const nombreCorto = colCorto ? (fila[colCorto] ?? '').trim() : '';
    const identificador = colId ? (fila[colId] ?? '').trim() : '';
    const clave = identificador
      ? (colId === colPf ? `pf:${identificador}` : `${fuenteId}:${colId}:${identificador}`)
      : `nom:${normalizarTexto(pais)}:${normalizarTexto(nombreCorto || nombre)}`;

    const medidas: MedidaCalculada[] = [];
    for (const m of medidasResueltas) {
      const valores: number[] = [];
      const usadas: string[] = [];
      for (const c of m.columnas) {
        const n = numero(fila[c.nombre] ?? '');
        if (n === null) continue;
        if (n < m.escalaMin || n > m.escalaMax) continue;
        valores.push(normalizarA10(n, m.escalaMin, m.escalaMax, c.orientacion) / 10);
        usadas.push(c.nombre);
      }
      if (valores.length < m.minimoPresentes) continue;
      if (usadas.length === 1) {
        const c = m.columnas.find(x => x.nombre === usadas[0])!;
        medidas.push({
          eje: m.eje,
          valorBruto: numero(fila[usadas[0]])!,
          escalaMin: m.escalaMin,
          escalaMax: m.escalaMax,
          orientacion: c.orientacion,
          columnas: usadas
        });
      } else {
        const media = valores.reduce((a, b) => a + b, 0) / valores.length;
        medidas.push({
          eje: m.eje,
          valorBruto: media,
          escalaMin: 0,
          escalaMax: 1,
          orientacion: 1,
          columnas: usadas
        });
      }
    }

    if (!medidas.length) {
      sinMedida++;
      continue;
    }

    const previo = registros.get(clave);
    if (todosLosAnios) {
      registros.set(`${clave}|${anio}`, { clave, nombre, nombreCorto, pais, paisCodigo: decodificado.codigo, anio, medidas });
    } else if (!previo || anio > previo.anio) {
      registros.set(clave, { clave, nombre, nombreCorto, pais, paisCodigo: decodificado.codigo, anio, medidas });
    }
  }

  const lista = Array.from(registros.values());
  console.log(`Entidades utilizables: ${lista.length}`);
  const paisesPresentes = new Set(Array.from(registros.values()).map(r => r.pais));
  console.log(`Paises con al menos una entidad: ${paisesPresentes.size}`);
  console.log(`Descartadas: ${fueraDePais} por filtro o pais, ${sinAnio} sin anio, ${sinMedida} sin ninguna medida`);
  if (desde !== null) console.log(`Descartadas por anterior a ${desde}: ${fueraDeHorizonte}`);
  console.log('');

  if (!lista.length) {
    console.error('Nada que cargar. Revisa el filtro --paises o el mapeo de columnas.\n');
    process.exit(1);
  }

  const muestra = lista.slice(0, 5);
  console.log('Muestra:');
  for (const r of muestra) {
    const detalle = r.medidas
      .map(m => `${m.eje}=${normalizarA10(m.valorBruto, m.escalaMin, m.escalaMax, m.orientacion).toFixed(2)}`)
      .join(' ');
    console.log(`  ${r.nombreCorto || r.nombre} (${r.pais}, ${r.anio})  ${detalle}`);
  }
  console.log('');

  if (seco) {
    console.log('Modo seco: no se ha escrito nada.\n');
    return;
  }

  const marca = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const horizonte = desde !== null ? `desde${desde}` : 'sinhorizonte';
  const version = `${fuenteId}-${ola || 'sin-ola'}-${horizonte}-${marca}`;

  const { error: eFuente } = await db().from('fuentes_externas').upsert({
    id: meta.id,
    nombre: meta.nombre,
    institucion: meta.institucion,
    tipo: meta.tipo,
    url: meta.url,
    licencia: meta.licencia,
    cita: meta.cita,
    ola: ola || null,
    actualizado_en: new Date().toISOString()
  }, { onConflict: 'id' });
  if (eFuente) throw eFuente;

  const enlaces = leerEnlaces();

  const ahora = new Date().toISOString();
  const base = lista.map(r => ({
    clave: r.clave,
    tipo: 'partido',
    nombre: r.nombre,
    nombre_corto: r.nombreCorto || null,
    pais_codigo: r.paisCodigo,
    pais_nombre: r.pais,
    actualizado_en: ahora
  }));

  const conSlug = base
    .filter(e => enlaces.has(e.clave))
    .map(e => ({ ...e, partido_slug: enlaces.get(e.clave)! }));
  const sinSlug = base.filter(e => !enlaces.has(e.clave));

  for (const grupo of [sinSlug, conSlug]) {
    for (let i = 0; i < grupo.length; i += 500) {
      const { error } = await db()
        .from('entidades_externas')
        .upsert(grupo.slice(i, i + 500), { onConflict: 'clave' });
      if (error) throw error;
    }
  }
  console.log(`Entidades escritas: ${base.length} (${conSlug.length} con slug espanol enlazado)`);

  const guardadas = await traerTodo<any>((a, b) =>
    db().from('entidades_externas').select('id, clave').range(a, b));
  const idPorClave = new Map(guardadas.map((e: any) => [e.clave, e.id]));

  const posiciones: any[] = [];
  for (const r of lista) {
    const entidadId = idPorClave.get(r.clave);
    if (!entidadId) continue;
    for (const m of r.medidas) {
      posiciones.push({
        fuente_id: fuenteId,
        entidad_id: entidadId,
        eje: m.eje,
        anio: r.anio,
        valor_bruto: m.valorBruto,
        escala_min: m.escalaMin,
        escala_max: m.escalaMax,
        orientacion: m.orientacion,
        columnas: m.columnas,
        publicado: false,
        version_carga: version
      });
    }
  }

  const { count: previas } = await db()
    .from('posiciones_externas')
    .select('*', { count: 'exact', head: true })
    .eq('fuente_id', fuenteId);

  if (previas && previas > 0) {
    const { error: eBorrado } = await db()
      .from('posiciones_externas')
      .delete()
      .eq('fuente_id', fuenteId);
    if (eBorrado) throw eBorrado;
    console.log(`Borradas ${previas} posiciones de cargas anteriores de ${fuenteId}.`);
  }

  for (let i = 0; i < posiciones.length; i += 500) {
    const { error } = await db()
      .from('posiciones_externas')
      .insert(posiciones.slice(i, i + 500));
    if (error) throw error;
  }

  const { count: totalEntidades } = await db()
    .from('entidades_externas')
    .select('*', { count: 'exact', head: true });
  const conPosicion = await traerTodo<any>((a, b) =>
    db().from('posiciones_externas').select('entidad_id').range(a, b));
  const distintas = new Set(conPosicion.map((x: any) => x.entidad_id)).size;
  const huerfanas = (totalEntidades ?? 0) - distintas;
  if (huerfanas > 0) {
    console.log(`AVISO: ${huerfanas} entidades sin ninguna posicion. Son restos de cargas`);
    console.log('anteriores y no salen en el mapa, pero conviene limpiarlas.');
  }

  console.log(`Posiciones escritas: ${posiciones.length}`);
  console.log(`Version de carga: ${version}\n`);
  console.log('Quedan SIN PUBLICAR hasta que verifiques los polos:');
  console.log('  npm run posiciones:verificar -- --fuente ' + fuenteId);
  console.log('  npm run posiciones:publicar -- --fuente ' + fuenteId + ' --eje izq_der\n');
}

if (bandera('estado')) {
  await estado();
} else if (bandera('verificar')) {
  await verificar();
} else if (bandera('publicar')) {
  await publicar();
} else if (bandera('proponer-enlaces')) {
  await proponerEnlaces();
} else {
  await cargar();
}