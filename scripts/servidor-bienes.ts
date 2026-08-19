import { createServer } from 'http';
import { db, exigirEnv } from '../src/lib/supabase';
import { leerDeclaracion } from '../src/lib/leer-declaracion';

exigirEnv('SUPABASE_URL');
const PUERTO = Number(process.env.PUERTO_ADMIN ?? 4321);

const CAMPOS: [string, string, string, string][] = [
  ['fecha_declaracion', 'Fecha de la declaración', 'date', 'Cabecera, arriba a la derecha'],
  ['url_declaracion', 'URL del PDF oficial', 'url', 'Pega el enlace del que has sacado los datos'],

  ['rendimientos_trabajo', 'Percepciones salariales', 'euros', 'Suma de la primera fila de RENTAS PERCIBIDAS'],
  ['rendimientos_capital', 'Dividendos e intereses', 'euros', 'Filas de dividendos y de intereses'],
  ['rendimientos_actividades', 'Otras rentas', 'euros', 'Fila OTRAS rentas o percepciones'],
  ['rentas_detalle', 'Conceptos de las rentas', 'texto', 'Copia los conceptos tal cual, separados por punto y coma'],
  ['irpf_pagado', 'IRPF pagado', 'euros', 'Recuadro CANTIDAD PAGADA POR IRPF'],
  ['sueldo_congreso', 'Sueldo del Congreso', 'euros', 'NO está en el PDF. Solo si lo consultas aparte'],

  ['inmuebles_urbanos', 'Inmuebles urbanos', 'entero', 'Cuenta las filas rellenas'],
  ['inmuebles_rusticos', 'Inmuebles rústicos', 'entero', 'Cuenta las filas rellenas'],
  ['inmuebles_detalle', 'Detalle de inmuebles', 'texto', 'Clase, provincia y porcentaje. Ej: vivienda, Madrid, 40%'],

  ['depositos', 'Depósitos en cuentas', 'euros', 'SALDO de todos los depósitos'],
  ['valores', 'Deuda, acciones y participaciones', 'euros', 'Suma de OTROS BIENES O DERECHOS'],
  ['planes_pensiones', 'Planes de pensiones', 'euros', 'Si aparece separado'],

  ['vehiculos', 'Número de vehículos', 'entero', 'Cuenta las filas de VEHÍCULOS'],
  ['vehiculos_detalle', 'Detalle de vehículos', 'texto', 'Ej: todoterreno Jeep; motocicleta BMW'],

  ['prestamos_concedido', 'Importe concedido', 'euros', 'Columna IMPORTE CONCEDIDO'],
  ['deuda_pendiente', 'Saldo pendiente', 'euros', 'Columna SALDO PENDIENTE'],

  ['observaciones', 'Observaciones', 'texto', 'Recuadro OBSERVACIONES, si tiene algo']
];

const PAGINA = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Entrada de bienes declarados</title>
<style>
*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;background:#EFEFE9;color:#14161A}
.wrap{max-width:900px;margin:0 auto;padding:20px}
h1{font-size:20px;margin:0 0 4px}
.sub{font-size:13px;color:#7C8288;margin-bottom:16px}
.barra{height:8px;background:#DCDCD3;border-radius:4px;overflow:hidden;margin-bottom:16px}
.barra div{height:100%;background:#2E7D5B}
.grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:820px){.grid{grid-template-columns:280px 1fr}}
.lista{background:#fff;border:1px solid #DCDCD3;border-radius:3px;max-height:70vh;overflow-y:auto}
.item{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-bottom:1px solid #F0F0EA;font-size:13px}
.item:hover{background:#F3F3EE}.item.sel{background:#14161A;color:#EFEFE9}
.item.hecho{opacity:.45}
.pip{width:3px;height:22px;border-radius:3px;flex-shrink:0}
.card{background:#fff;border:1px solid #DCDCD3;border-radius:3px;padding:16px}
label{display:block;font-size:12px;color:#4A5057;margin:10px 0 3px}
input,textarea{width:100%;padding:8px 10px;font-size:14px;border:1px solid #DCDCD3;border-radius:2px;font-family:inherit}
button{padding:10px 18px;font-size:14px;font-weight:600;background:#14161A;color:#EFEFE9;border:none;border-radius:2px;cursor:pointer}
button.sec{background:transparent;color:#4A5057;border:1px solid #DCDCD3;font-weight:400}
.fila{display:flex;gap:10px;margin-top:16px;align-items:center}
.ok{color:#2E7D5B;font-size:13px}.err{color:#B23A2E;font-size:13px}
.ayuda{display:block;font-size:10.5px;color:#9AA0A6;font-weight:400;margin-top:1px}
.regla{background:#FFF8E6;border:1px solid #E8D9A8;border-radius:3px;padding:11px;font-size:12px;color:#6B5518;line-height:1.5;margin-bottom:14px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
</style></head><body><div class="wrap">
<h1>Entrada de bienes declarados</h1>
<div class="sub">Los datos se leen del PDF oficial de cada diputado y se guardan con su enlace. Solo tú, en local.</div>
<div class="barra"><div id="prog" style="width:0"></div></div>
<div class="regla"><strong>Regla:</strong> copia solo lo que pone el documento. Si una casilla está vacía,
déjala vacía; no pongas cero. No sumes nada que no esté escrito. El sueldo del Congreso no aparece en la
declaración: solo rellénalo si lo consultas en la web de retribuciones, y quedará como campo aparte.</div>
<div class="grid">
  <div class="lista" id="lista"></div>
  <div class="card">
    <div id="quien" style="font-size:17px;font-weight:600;margin-bottom:2px">Elige un diputado</div>
    <div id="meta" style="font-size:12px;color:#7C8288"></div>
    <div id="campos" class="cols"></div>
    <div class="fila">
      <button onclick="guardar()">Guardar y siguiente</button>
      <button class="sec" onclick="leerPdf()">Leer PDF automáticamente</button>
      <button class="sec" onclick="saltar()">Saltar</button>
      <span id="msg"></span>
    </div>
    <div id="aviso"></div>
  </div>
</div></div>
<script>
const CAMPOS = ${JSON.stringify(CAMPOS)};
let dips = [], actual = null;

async function cargar() {
  dips = await (await fetch('/api/pendientes')).json();
  pintarLista();
  const p = dips.filter(d => d.hecho).length;
  document.getElementById('prog').style.width = (p / dips.length * 100) + '%';
  document.querySelector('.sub').textContent =
    p + ' de ' + dips.length + ' completados. Los datos se guardan con el enlace al PDF oficial.';
  if (!actual) elegir(dips.find(d => !d.hecho));
}

function pintarLista() {
  document.getElementById('lista').innerHTML = dips.map((d, i) =>
    '<div class="item ' + (d.hecho ? 'hecho ' : '') + (actual && actual.mandato_id === d.mandato_id ? 'sel' : '') +
    '" onclick="elegir(dips[' + i + '])"><span class="pip" style="background:' + (d.color || '#8E9299') + '"></span>' +
    '<span>' + d.nombre_completo + '<br><small style="opacity:.65">' + (d.partido_siglas || '') + ' · ' + (d.circunscripcion || '') + '</small></span></div>'
  ).join('');
}

async function elegir(d) {
  if (!d) return;
  actual = d;
  pintarLista();
  document.getElementById('quien').textContent = d.nombre_completo;
  document.getElementById('meta').innerHTML = (d.partido_siglas || '') + ' · ' + (d.circunscripcion || '') +
    ' — <a href="https://www.congreso.es/es/busqueda-de-diputados" target="_blank">buscar su declaración →</a>';
  const previo = await (await fetch('/api/uno?id=' + d.mandato_id)).json();
  document.getElementById('campos').innerHTML = CAMPOS.map(([k, etiqueta, tipo, ayuda]) =>
    '<div style="grid-column:' + (tipo === 'texto' || tipo === 'url' ? 'span 2' : 'span 1') + '">' +
    '<label>' + etiqueta + '<span class="ayuda">' + (ayuda || '') + '</span></label>' +
    (tipo === 'texto' ? '<textarea id="f_' + k + '" rows="2"></textarea>'
      : '<input id="f_' + k + '" type="' + (tipo === 'date' ? 'date' : 'text') + '" ' +
        (tipo === 'euros' ? 'inputmode="decimal" placeholder="0,00"' : '') + '>') + '</div>'
  ).join('');
  CAMPOS.forEach(([k]) => {
    const el = document.getElementById('f_' + k);
    if (el && previo && previo[k] !== null && previo[k] !== undefined) el.value = previo[k];
  });
  document.getElementById('msg').textContent = '';
}

function numero(v) {
  if (!v || !String(v).trim()) return null;
  const n = parseFloat(String(v).replace(/\\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

async function guardar() {
  if (!actual) return;
  const cuerpo = { mandato_id: actual.mandato_id };
  CAMPOS.forEach(([k, , tipo]) => {
    const v = document.getElementById('f_' + k)?.value;
    cuerpo[k] = (tipo === 'euros' || tipo === 'entero') ? numero(v) : (v || null);
  });
  const r = await fetch('/api/guardar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const msg = document.getElementById('msg');
  if (r.ok) {
    msg.className = 'ok'; msg.textContent = 'guardado';
    const i = dips.findIndex(d => d.mandato_id === actual.mandato_id);
    if (i >= 0) dips[i].hecho = true;
    await cargar();
    elegir(dips.find(d => !d.hecho));
  } else {
    msg.className = 'err'; msg.textContent = await r.text();
  }
}

function saltar() {
  const i = dips.findIndex(d => d.mandato_id === actual?.mandato_id);
  elegir(dips[i + 1]);
}

async function leerPdf() {
  const url = document.getElementById('f_url_declaracion')?.value?.trim();
  const msg = document.getElementById('msg');
  const aviso = document.getElementById('aviso');
  if (!url) { msg.className = 'err'; msg.textContent = 'pega antes la URL del PDF'; return; }

  msg.className = ''; msg.textContent = 'leyendo el PDF…'; aviso.innerHTML = '';
  const r = await fetch('/api/leer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  const j = await r.json();

  if (!j.ok) { msg.className = 'err'; msg.textContent = j.error || 'no se pudo leer'; return; }

  let rellenados = 0;
  CAMPOS.forEach(([k]) => {
    if (k === 'url_declaracion') return;
    const el = document.getElementById('f_' + k);
    const v = j.datos[k];
    if (el && v !== null && v !== undefined && String(v) !== '') {
      el.value = typeof v === 'number' ? String(v).replace('.', ',') : v;
      el.style.background = '#FFF8E6';
      rellenados++;
    }
  });

  msg.className = 'ok'; msg.textContent = rellenados + ' campos rellenados';
  const clase = j.datos.confianza === 'alta' ? 'regla' : 'regla';
  aviso.innerHTML = '<div class="' + clase + '" style="margin-top:14px">' +
    '<strong>Leído automáticamente · confianza ' + j.datos.confianza + '.</strong> ' +
    'Los campos en amarillo los ha rellenado la máquina. <strong>Compruébalos uno a uno contra el PDF</strong> ' +
    'antes de guardar.' +
    (j.datos.dudas && j.datos.dudas.length
      ? '<br><br>No ha podido leer con seguridad:<ul style="margin:6px 0 0 16px"><li>' +
        j.datos.dudas.join('</li><li>') + '</li></ul>'
      : '') +
    '</div>';
}

document.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') guardar(); });
cargar();
</script></body></html>`;

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGINA);
  }

  if (url.pathname === '/api/pendientes') {
    const { data } = await db().rpc('pendientes_bienes');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data ?? []));
  }

  if (url.pathname === '/api/uno') {
    const { data } = await db().from('bienes_declarados').select('*')
      .eq('mandato_id', url.searchParams.get('id')).maybeSingle();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data ?? {}));
  }

  if (url.pathname === '/api/leer' && req.method === 'POST') {
    let cuerpo = '';
    for await (const c of req) cuerpo += c;
    const { url: pdf } = JSON.parse(cuerpo);
    const r = await leerDeclaracion(pdf);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(r));
  }

  if (url.pathname === '/api/guardar' && req.method === 'POST') {
    let cuerpo = '';
    for await (const c of req) cuerpo += c;
    const fila = { ...JSON.parse(cuerpo), introducido_por: 'revision_humana', introducido_at: new Date().toISOString(), verificado: true };
    const { error } = await db().from('bienes_declarados').upsert(fila, { onConflict: 'mandato_id' });
    if (error) { res.writeHead(400); return res.end(error.message); }
    res.writeHead(200); return res.end('ok');
  }

  res.writeHead(404); res.end();
}).listen(PUERTO, () => {
  console.log(`\nEntrada de bienes en http://localhost:${PUERTO}\n`);
  console.log('  1. Pega la URL del PDF y pulsa "Leer PDF automaticamente".');
  console.log('  2. Comprueba los campos amarillos contra el documento.');
  console.log('  3. Ctrl+Enter guarda y pasa al siguiente.');
  console.log('  Todo queda con la URL del PDF oficial como fuente.\n');
});