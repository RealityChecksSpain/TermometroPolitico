import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { db, exigirEnv } from '../src/lib/supabase';
import { refrescarCaches } from '../src/lib/metricas';
import {
  BASE_AND, WEB_AND, CODIGO_GRUPO, SLUG_PARTIDO, pedir, pedirHtml, lineasPdf, llano, nombreDeListado,
  leerListadoDiputados, leerFicha, leerVotaciones, leerDeclaraciones, resumenInmuebles, siglasDeGrupo,
  type DeclaracionAnd, type VotacionAnd
} from '../src/lib/andalucia';

if (!process.argv.includes('--simular')) exigirEnv('SUPABASE_URL');

const CAMARA = 'parlamento-andalucia';
const ACTUAL = 13;
const argv = process.argv.slice(2);
const solo = (k: string) => argv.includes(`--solo-${k}`);
const hacer = (k: string) => !argv.some(a => a.startsWith('--solo-')) || solo(k);
const RELEER = argv.includes('--releer');
const SIMULAR = argv.includes('--simular');
const PAUSA = 700;
const CARPETA = join(homedir(), 'andalucia-sondeo');
const pausa = (ms = PAUSA) => new Promise(r => setTimeout(r, ms));

const FUENTES_CANDIDATOS = [
  { fuente: 'BOPA extraordinario 100, 27/04/2026', url: `${WEB_AND}/pdf.do?tipodoc=bopa&id=202654`, fecha: '2026-04-27' },
  { fuente: 'BOJA extraordinario 7, 28/04/2026', url: 'https://www.juntadeandalucia.es/boja/2026/507/BOJA26-507-00006-5757-01_00336993.pdf', fecha: '2026-04-28' },
  { fuente: 'BOJA nº 86, 07/05/2026', url: 'https://www.juntadeandalucia.es/boja/2026/86/BOJA26-086-00009-6005-01_00337241.pdf', fecha: '2026-05-07' },
  { fuente: 'BOJA nº 92, 15/05/2026', url: 'https://www.juntadeandalucia.es/boja/2026/92/BOJA26-092-00005-6418-01_00337654.pdf', fecha: '2026-05-15' }
];

async function partidos(): Promise<Map<string, string>> {
  if (SIMULAR) return new Map();
  const { data, error } = await db().from('partidos').select('id, slug').in('slug', Object.values(SLUG_PARTIDO));
  if (error) throw error;
  return new Map((data ?? []).map((p: any) => [p.slug, p.id]));
}

async function enLotes(tabla: string, filas: any[], conflicto: string) {
  if (SIMULAR) { console.log(`  [simulación] ${tabla}: ${filas.length} filas sin guardar`); return; }
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await db().from(tabla).upsert(filas.slice(i, i + 500), { onConflict: conflicto });
    if (error) throw new Error(`${tabla}: ${error.message}`);
  }
}

async function bajarPdf(url: string, nombre: string): Promise<Uint8Array> {
  const ruta = join(CARPETA, 'pdf', nombre);
  if (!RELEER && existsSync(ruta)) return new Uint8Array(await readFile(ruta));
  const r = await pedir(url);
  const buf = new Uint8Array(await r.arrayBuffer());
  await writeFile(ruta, buf);
  await pausa();
  return buf;
}

interface DipCargado { id_externo: string; apellidos_nombre: string; nombre_completo: string; circunscripcion: string | null; escano: number | null; partido_siglas: string | null; activo: boolean }

async function cargarDiputados(): Promise<DipCargado[]> {
  const ids = await partidos();
  const html = await pedirHtml(`${WEB_AND}/composicionyfuncionamiento/diputadosysenadores.do`);
  const listado = leerListadoDiputados(html, ACTUAL);
  console.log(`Diputados XIII en la web: ${listado.length} (${listado.filter(d => d.renuncia).length} renuncias)`);
  if (listado.filter(d => !d.renuncia).length < 100) throw new Error('El listado trae menos de 100 diputados en activo: no se carga nada.');
  const filas: any[] = [];
  for (const d of listado) {
    const url = `${WEB_AND}/composicionyfuncionamiento/diputadosysenadores.do?codmie=${d.codmie}&nlegis=${ACTUAL}&codorg=3&cirele=0&accion=Ver%20Diputados`;
    let ficha = null;
    try { ficha = leerFicha(await pedirHtml(url), d.codmie); } catch (e) { console.error(`  ficha ${d.nombre}: ${(e as Error).message}`); }
    await pausa();
    const siglas = (d.grupoCodigo && CODIGO_GRUPO[d.grupoCodigo]) || siglasDeGrupo(ficha?.grupo);
    filas.push({
      camara: CAMARA,
      legislatura: ACTUAL,
      id_externo: String(d.codmie),
      nombre_completo: ficha?.nombre_completo ?? nombreDeListado(d.nombre),
      apellidos_nombre: d.nombre,
      grupo: ficha?.grupo ?? null,
      partido_siglas: siglas,
      partido_id: siglas && SLUG_PARTIDO[siglas] ? ids.get(SLUG_PARTIDO[siglas]) ?? null : null,
      circunscripcion: ficha?.circunscripcion ?? null,
      escano: ficha?.escano ?? null,
      foto_url: `${WEB_AND}/fotografia.do?codmie=${d.codmie}&nlegis=${ACTUAL}`,
      url_ficha: url,
      activo: !d.renuncia,
      actualizado_at: new Date().toISOString()
    });
  }
  await enLotes('parl_diputados', filas, 'camara,legislatura,id_externo');
  console.log(`  guardados ${filas.length}`);
  return filas;
}

async function diputadosGuardados(): Promise<DipCargado[]> {
  const { data, error } = await db().from('parl_diputados')
    .select('id_externo, apellidos_nombre, nombre_completo, circunscripcion, escano, partido_siglas, activo')
    .eq('camara', CAMARA).eq('legislatura', ACTUAL);
  if (error) throw error;
  return (data ?? []) as DipCargado[];
}

async function avisosBoja(anyo: number): Promise<{ fuente: string; url: string; fecha: string | null }[]> {
  const cache = join(CARPETA, `boja-${anyo}.json`);
  const previo: { numeros: number[]; avisos: { fuente: string; url: string; fecha: string | null }[] } =
    existsSync(cache) ? JSON.parse(await readFile(cache, 'utf8')) : { numeros: [], avisos: [] };
  const vistos = new Set(previo.numeros);
  let vacios = 0;
  for (let n = 1; n < 400 && vacios < 4; n++) {
    if (vistos.has(n)) continue;
    let html = '';
    try { html = await pedirHtml(`https://www.juntadeandalucia.es/boja/${anyo}/${n}/s54`); } catch { vacios++; continue; }
    if (!/BOJA/.test(html) || /no se ha encontrado|página no encontrada/i.test(html)) { vacios++; continue; }
    vacios = 0;
    for (const m of html.matchAll(/declaraciones sobre actividades, bienes[\s\S]{0,400}?diputados del Parlamento de Andaluc/gi)) {
      const tramo = html.slice(Math.max(0, (m.index ?? 0) - 4000), (m.index ?? 0) + 1500);
      const pdf = [...tramo.matchAll(/href="([^"]*BOJA\d\d-\d{3}-[^"]+\.pdf)"/g)].map(x => x[1]).pop();
      if (pdf) {
        const url = pdf.startsWith('http') ? pdf : `https://www.juntadeandalucia.es/boja/${anyo}/${n}/${pdf.split('/').pop()}`;
        if (!previo.avisos.some(a => a.url === url)) previo.avisos.push({ fuente: `BOJA nº ${n} de ${anyo}`, url, fecha: null });
      }
    }
    previo.numeros.push(n);
    await pausa(300);
  }
  const ultimo = Math.max(0, ...previo.numeros);
  previo.numeros = previo.numeros.filter(n => n < ultimo - 3);
  await writeFile(cache, JSON.stringify(previo, null, 1));
  return previo.avisos;
}

function ordenListado(apellidosNombre: string): string {
  const [ap, nom = ''] = apellidosNombre.split(',').map(t => t.trim());
  const particula = nom.match(/\s+(de la|de los|del|de)$/i)?.[1];
  return particula ? `${particula} ${ap} ${nom.slice(0, -particula.length).trim()}` : `${ap} ${nom}`;
}

function emparejar(decl: DeclaracionAnd, dips: DipCargado[]): DipCargado | null {
  const clave = llano(`${decl.apellidos} ${decl.nombre}`);
  const exacto = dips.filter(d => llano(ordenListado(d.apellidos_nombre)) === clave);
  if (exacto.length === 1) return exacto[0];
  const ap = llano(decl.apellidos);
  const nom = llano(decl.nombre).split(' ')[0];
  const parecidos = dips.filter(d => {
    const [a, n] = d.apellidos_nombre.split(',').map(llano);
    return a === ap && (n ?? '').split(' ')[0] === nom;
  });
  if (parecidos.length === 1) return parecidos[0];
  return null;
}

function filaBienes(dip: DipCargado, decl: DeclaracionAnd, fuente: { fuente: string; url: string; fecha: string | null }) {
  const r = resumenInmuebles(decl.inmuebles);
  const suma = (l: { valor: number | null }[]) => l.some(x => x.valor != null) ? Math.round(l.reduce((s, x) => s + (x.valor ?? 0), 0) * 100) / 100 : null;
  return {
    camara: CAMARA,
    legislatura: ACTUAL,
    id_externo: dip.id_externo,
    fuente: fuente.fuente,
    fuente_url: fuente.url,
    pagina: decl.pagina,
    motivo: decl.motivo ?? 'Candidatura a las elecciones del 17 de mayo de 2026',
    fecha_publicacion: fuente.fecha,
    inmuebles: decl.inmuebles,
    ...r,
    saldo_cuentas: decl.saldo_cuentas,
    saldo_porcentaje: decl.saldo_porcentaje,
    valores: decl.valores,
    valores_total: suma(decl.valores),
    bienes_otros: decl.bienes_otros,
    deudas: decl.deudas,
    deudas_total: suma(decl.deudas),
    cargos_publicos: decl.cargos_publicos,
    actividades_privadas: decl.actividades_privadas,
    leido_at: new Date().toISOString()
  };
}

async function cargarBienes(dips: DipCargado[]) {
  const elegidas = new Map<string, any>();
  const leer = async (f: { fuente: string; url: string; fecha: string | null }, soloDiputados: boolean) => {
    const nombre = `${f.url.replace(/[^a-z0-9]+/gi, '_').slice(-80)}.pdf`;
    const decls = leerDeclaraciones(await lineasPdf(await bajarPdf(f.url, nombre)));
    let usadas = 0;
    for (const d of decls) {
      if (soloDiputados && d.legislatura !== 'XIII') continue;
      if (/P[ée]rdida de la condici/i.test(d.motivo ?? '')) continue;
      const dip = emparejar(d, dips);
      if (!dip) continue;
      elegidas.set(dip.id_externo, filaBienes(dip, d, f));
      usadas++;
    }
    console.log(`  ${f.fuente}: ${decls.length} declaraciones, ${usadas} de diputados de la XIII`);
  };
  for (const f of FUENTES_CANDIDATOS) await leer(f, false);
  const avisos = (await avisosBoja(2026)).sort((a, b) => Number(a.fuente.match(/\d+/)?.[0]) - Number(b.fuente.match(/\d+/)?.[0]));
  for (const f of avisos) await leer(f, true);
  const sin = dips.filter(d => d.activo && !elegidas.has(d.id_externo));
  await enLotes('parl_bienes', [...elegidas.values()], 'camara,legislatura,id_externo');
  console.log(`Declaraciones guardadas: ${elegidas.size}.${sin.length ? ` Sin declaración encontrada (${sin.length}): ${sin.map(d => d.apellidos_nombre).join('; ')}` : ''}`);
}

function apellidosListado(apellidosNombre: string): string {
  const [ap, nom = ''] = apellidosNombre.split(',').map(t => t.trim());
  const particula = nom.match(/\s+(de la|de los|del|de)$/i)?.[1];
  return llano(particula ? `${particula} ${ap}` : ap);
}

function diputadoDeVoto(escano: number, nombre: string, porEscano: Map<number | null, DipCargado>, dips: DipCargado[]): string | null {
  const apVoto = llano(nombre.split(',')[0]);
  const d = porEscano.get(escano);
  if (d && apellidosListado(d.apellidos_nombre) === apVoto) return d.id_externo;
  const porApellidos = dips.filter(x => apellidosListado(x.apellidos_nombre) === apVoto);
  if (porApellidos.length === 1) return porApellidos[0].id_externo;
  const palabras = llano(nombre.replace(',', ' ')).split(' ').filter(Boolean);
  const porPalabras = dips.filter(x => {
    const suyas = new Set(llano(ordenListado(x.apellidos_nombre)).split(' '));
    return palabras.length >= 3 && palabras.every(p => suyas.has(p));
  });
  return porPalabras.length === 1 ? porPalabras[0].id_externo : null;
}

interface DocVotos { id: string; texto: string }

async function documentosVotos(leg: number): Promise<DocVotos[]> {
  const docs: DocVotos[] = [];
  for (let indice = 0; indice < 3000; indice += 15) {
    const html = await pedirHtml(`${WEB_AND}/composicionyfuncionamiento/resultadosvotaciones.do?accion=Buscar&seleccion=publicadosen&legislatura=${leg}&terminos=&keywords=&indice=${indice}`);
    const nuevos = [...html.matchAll(/tipodoc=diario&(?:amp;)?id=(\d+)/g)].map(m => m[1]).filter(id => !docs.some(d => d.id === id));
    for (const id of nuevos) docs.push({ id, texto: '' });
    await pausa();
    if (!nuevos.length) break;
  }
  return docs;
}

function resultado(si: number, no: number): string {
  if (si > no) return 'aprobada';
  if (no > si) return 'rechazada';
  return 'empate';
}

async function cargarVotos(leg: number, dips: DipCargado[]) {
  const { data: hechas } = SIMULAR ? { data: [] } : await db().from('parl_votaciones').select('fuente_url').eq('camara', CAMARA).eq('legislatura', leg);
  const yaHechas = new Set((hechas ?? []).map((h: any) => h.fuente_url));
  const docs = await documentosVotos(leg);
  console.log(`Legislatura ${leg}: ${docs.length} documentos de votaciones`);
  const porEscano = new Map(dips.map(d => [d.escano, d]));
  let nuevas = 0;
  let sinEmparejar = 0;
  for (const doc of docs) {
    const url = `${WEB_AND}/pdf.do?tipodoc=diario&id=${doc.id}`;
    if (!RELEER && yaHechas.has(url)) continue;
    let votaciones: VotacionAnd[] = [];
    try { votaciones = leerVotaciones(await lineasPdf(await bajarPdf(url, `votos-${leg}-${doc.id}.pdf`))); }
    catch (e) { console.error(`  documento ${doc.id}: ${(e as Error).message}`); continue; }
    const filasV: any[] = [];
    const filasVo: any[] = [];
    for (const v of votaciones) {
      if (!v.sesion || !v.numero) continue;
      const id = `and-${leg}-${v.sesion}-${v.numero}`;
      const t = (k: string) => v.totales[k]?.TOTAL ?? null;
      const si = t('TOTAL SI') ?? 0;
      const no = t('TOTAL NO') ?? 0;
      filasV.push({
        id, camara: CAMARA, legislatura: leg, sesion: v.sesion, numero: v.numero, protocolo: v.protocolo,
        fecha: v.fecha ? `${v.fecha}+02:00` : null, expediente: v.expediente, tipo_iniciativa: v.tipo_iniciativa,
        titulo_general: v.titulo_general, titulo_particular: v.titulo_particular,
        si, no, abstencion: t('TOTAL ABSTENCIONES'), blanco: t('TOTAL BLANCOS'), ausentes: t('DIPUTADOS AUSENTES'),
        presentes: t('PRESENTES'), resultado: resultado(si, no), totales: v.totales, fuente_url: url,
        importada_at: new Date().toISOString()
      });
      const vistos = new Set<string>();
      for (const vo of v.votos) {
        const k = `${vo.escano}|${vo.nombre}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        const idExt = leg === ACTUAL ? diputadoDeVoto(vo.escano, vo.nombre, porEscano, dips) : null;
        if (leg === ACTUAL && !idExt) sinEmparejar++;
        filasVo.push({
          votacion_id: id, escano: vo.escano, nombre: vo.nombre, grupo: vo.grupo,
          partido_siglas: siglasDeGrupo(vo.grupo), id_externo: idExt, voto: vo.voto, delegado: vo.delegado
        });
      }
    }
    await enLotes('parl_votaciones', filasV, 'id');
    await enLotes('parl_votos', filasVo, 'votacion_id,escano,nombre');
    nuevas += filasV.length;
    console.log(`  documento ${doc.id}: ${filasV.length} votaciones, ${filasVo.length} votos`);
  }
  console.log(`Legislatura ${leg}: ${nuevas} votaciones nuevas.${sinEmparejar ? ` ${sinEmparejar} votos sin emparejar con un diputado de la XIII.` : ''}`);
}

async function main() {
  const avisoOriginal = console.warn;
  console.warn = (...args: any[]) => {
    if (/TT: undefined function|glyf|Required .* table/i.test(String(args[0] ?? ''))) return;
    avisoOriginal(...args);
  };
  console.log(`\nPARLAMENTO DE ANDALUCÍA  ${new Date().toISOString()}\n`);
  await mkdir(join(CARPETA, 'pdf'), { recursive: true });
  const dips = hacer('diputados') || SIMULAR ? await cargarDiputados() : await diputadosGuardados();
  if (!dips.length) throw new Error('No hay diputados cargados. Corre antes npm run andalucia -- --solo-diputados');
  if (hacer('bienes')) await cargarBienes(dips);
  if (hacer('votos')) {
    await cargarVotos(ACTUAL, dips);
    await cargarVotos(12, dips);
  }
  if (!SIMULAR) await refrescarCaches();
  console.log(`\nFuente: ${BASE_AND}. PDF guardados en ${join(CARPETA, 'pdf')}.\n`);
}

main().catch(e => {
  console.error(`\nERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
