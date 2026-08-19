function celda(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return '"' + v.join('; ').replace(/"/g, '""') + '"';
  if (typeof v === 'object') return '"' + JSON.stringify(v).replace(/"/g, '""') + '"';
  const s = String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function aCsv(filas, columnas) {
  if (!filas?.length) return '';
  const cols = columnas ?? Object.keys(filas[0]);
  const cabecera = cols.join(';');
  const cuerpo = filas.map(f => cols.map(c => celda(f[c])).join(';'));
  return '\uFEFF' + [cabecera, ...cuerpo].join('\r\n');
}

export function descargar(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
