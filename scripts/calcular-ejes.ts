import { db, exigirEnv } from '../src/lib/supabase';
import { pca, escalarA, correlacion, MatrizVotos } from '../src/lib/pca';
import { posicionConsenso } from '../src/lib/posiciones';

const legislaturaId = exigirEnv('LEGISLATURA_ACTIVA_ID');
const MIN_VOTOS = Number(process.env.MIN_VOTOS ?? 100);

const VALOR: Record<string, number> = { si: 1, no: -1, abstencion: 0 };

async function paginar<T>(consulta: (desde: number, hasta: number) => any): Promise<T[]> {
  const tam = 1000;
  const salida: T[] = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await consulta(desde, desde + tam - 1);
    if (error) throw error;
    if (!data?.length) break;
    salida.push(...data);
    if (data.length < tam) break;
    desde += tam;
  }
  return salida;
}

console.log('\nCargando votos...');

const votos = await paginar<any>((a, b) =>
  db().from('votos').select('votacion_id, mandato_id, voto').range(a, b)
);
console.log(`  ${votos.length} votos individuales`);

const mandatos = await paginar<any>((a, b) =>
  db()
    .from('mandatos')
    .select('id, politicos!inner(nombre_completo), partidos:partido_efectivo_id(slug)')
    .eq('legislatura_id', legislaturaId)
    .range(a, b)
);

const nombrePorMandato = new Map<string, string>();
const partidoPorMandato = new Map<string, string>();
mandatos.forEach((m: any) => {
  nombrePorMandato.set(m.id, m.politicos.nombre_completo);
  if (m.partidos?.slug) partidoPorMandato.set(m.id, m.partidos.slug);
});

const contador = new Map<string, number>();
votos.forEach(v => {
  if (VALOR[v.voto] === undefined) return;
  contador.set(v.mandato_id, (contador.get(v.mandato_id) ?? 0) + 1);
});

const filas = Array.from(contador.entries())
  .filter(([, n]) => n >= MIN_VOTOS)
  .map(([id]) => id)
  .sort();

const columnasSet = new Set<string>();
votos.forEach(v => {
  if (VALOR[v.voto] !== undefined) columnasSet.add(v.votacion_id);
});
const columnas = Array.from(columnasSet).sort();

console.log(`  ${filas.length} diputados con >= ${MIN_VOTOS} votos`);
console.log(`  ${columnas.length} votaciones nominales`);

const idxFila = new Map(filas.map((f, i) => [f, i]));
const idxCol = new Map(columnas.map((c, i) => [c, i]));

const n = filas.length;
const p = columnas.length;
const datos = new Float64Array(n * p);
const presentes = new Uint8Array(n * p);

votos.forEach(v => {
  const val = VALOR[v.voto];
  if (val === undefined) return;
  const i = idxFila.get(v.mandato_id);
  const j = idxCol.get(v.votacion_id);
  if (i === undefined || j === undefined) return;
  datos[i * p + j] = val;
  presentes[i * p + j] = 1;
});

const matriz: MatrizVotos = { filas, columnas, datos, presentes };

console.log('\nCalculando componentes principales...');
const inicio = Date.now();
const resultado = pca(matriz, 2);
console.log(`  hecho en ${((Date.now() - inicio) / 1000).toFixed(1)}s`);

interface Eje {
  numero: number;
  valores: Float64Array;
  varianza: number;
  correlacion: number;
  polos: [string, string];
  huecoMaximo: number;
  esContinuo: boolean;
  etiqueta: string;
}

function diagnosticoForma(centroides: [string, number][]) {
  const valores = centroides.map(c => c[1]);
  const rango = valores[valores.length - 1] - valores[0];
  let hueco = 0;
  let corte = 0;
  for (let i = 1; i < valores.length; i++) {
    const d = valores[i] - valores[i - 1];
    if (d > hueco) {
      hueco = d;
      corte = i;
    }
  }
  const proporcion = rango > 0 ? hueco / rango : 0;
  return {
    huecoMaximo: proporcion,
    corte,
    esContinuo: proporcion < 0.35
  };
}

const ejes: Eje[] = resultado.componentes.map((c, i) => ({
  numero: i + 1,
  valores: escalarA(c.valores),
  varianza: c.varianzaExplicada,
  correlacion: 0,
  polos: ['', ''] as [string, string],
  huecoMaximo: 0,
  esContinuo: false,
  etiqueta: ''
}));

function centroides(valores: Float64Array): Map<string, number> {
  const suma = new Map<string, number>();
  const cuenta = new Map<string, number>();
  filas.forEach((mandatoId, i) => {
    const partido = partidoPorMandato.get(mandatoId);
    if (!partido) return;
    suma.set(partido, (suma.get(partido) ?? 0) + valores[i]);
    cuenta.set(partido, (cuenta.get(partido) ?? 0) + 1);
  });
  const salida = new Map<string, number>();
  suma.forEach((s, partido) => salida.set(partido, s / cuenta.get(partido)!));
  return salida;
}

for (const eje of ejes) {
  const c = centroides(eje.valores);
  const ordenado = Array.from(c.entries()).sort((a, b) => a[1] - b[1]);

  const externas: number[] = [];
  const calculadas: number[] = [];
  ordenado.forEach(([partido, valor]) => {
    const ext = posicionConsenso(partido, 'izq_der');
    if (ext) {
      externas.push(ext.valor);
      calculadas.push(valor);
    }
  });
  const r = correlacion(calculadas, externas);

  const forma = diagnosticoForma(ordenado);
  eje.huecoMaximo = forma.huecoMaximo;
  eje.esContinuo = forma.esContinuo;

  const correlacionAlta = Math.abs(r) > 0.8;
  eje.etiqueta = forma.esContinuo && correlacionAlta
    ? 'Izquierda - Derecha'
    : forma.esContinuo
      ? 'Eje sin interpretar'
      : 'Bloque parlamentario';

  console.log(`\nEJE ${eje.numero}  varianza explicada ${(eje.varianza * 100).toFixed(1)}%`);
  console.log(`  correlacion con CHES izq-der: ${r.toFixed(3)}`);
  console.log(`  hueco maximo entre partidos: ${(forma.huecoMaximo * 100).toFixed(1)}% del rango`);
  console.log(`  forma: ${forma.esContinuo ? 'CONTINUO' : 'BIMODAL (dos bloques separados)'}`);
  console.log(`  ETIQUETA: ${eje.etiqueta}`);
  if (!forma.esContinuo) {
    console.log('  AVISO: un eje bimodal mide pertenencia a bloque, no ideologia.');
    console.log('         La correlacion con CHES es espuria: en Espana el bloque de');
    console.log('         investidura es de izquierdas, asi que cualquier eje');
    console.log('         gobierno-oposicion correlaciona con izquierda-derecha.');
  }
  console.log('  centroides por partido:');
  ordenado.forEach(([partido, valor]) => {
    const barra = '#'.repeat(Math.round((valor + 1) * 20));
    console.log(`    ${partido.padEnd(12)} ${valor.toFixed(3).padStart(7)}  ${barra}`);
  });

  eje.correlacion = r;
  eje.polos = [ordenado[0][0], ordenado[ordenado.length - 1][0]] as [string, string];
}

if (process.argv.includes('--solo-informe')) {
  console.log('\nModo informe. No se ha guardado nada.\n');
  process.exit(0);
}

console.log('\nGuardando...');

for (const eje of ejes) {
  const etiqueta = eje.etiqueta;

  const { data: filaEje, error } = await db()
    .from('ejes_calculados')
    .upsert(
      {
        legislatura_id: legislaturaId,
        numero: eje.numero,
        etiqueta,
        polo_negativo: eje.polos[0],
        polo_positivo: eje.polos[1],
        varianza_explicada: eje.varianza,
        correlacion_ches: eje.correlacion,
        metodo: eje.esContinuo ? 'pca_votaciones' : 'pca_votaciones_bimodal',
        votaciones_usadas: columnas.length,
        mandatos_usados: filas.length,
        calculado_at: new Date().toISOString()
      },
      { onConflict: 'legislatura_id,numero' }
    )
    .select('id')
    .single();

  if (error) throw error;

  const lote = filas.map((mandatoId, i) => ({
    mandato_id: mandatoId,
    eje_id: filaEje.id,
    valor: eje.valores[i],
    votos_emitidos: resultado.votosPorFila[i]
  }));

  for (let k = 0; k < lote.length; k += 500) {
    const { error: e2 } = await db()
      .from('posiciones_calculadas')
      .upsert(lote.slice(k, k + 500), { onConflict: 'mandato_id,eje_id' });
    if (e2) throw e2;
  }

  console.log(`  eje ${eje.numero} "${etiqueta}": ${lote.length} posiciones`);
}

await db().rpc('refrescar_metricas');
console.log('  metricas refrescadas');

console.log('\nLISTO. Comprueba: select * from v_centroides_partido order by eje1;\n');
export {};
