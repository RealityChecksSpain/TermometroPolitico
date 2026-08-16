export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bm[ªa]\b/g, 'maria')
    .replace(/[^a-z0-9,\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clavesBusqueda(nombre: string): string[] {
  const norm = normalizarNombre(nombre);
  const [apellidos = '', propio = ''] = norm.split(',').map(s => s.trim());
  const claves = [norm];
  if (apellidos && propio) {
    claves.push(`${propio} ${apellidos}`);
    const primerApellido = apellidos.split(' ')[0];
    const primerNombre = propio.split(' ')[0];
    claves.push(`${primerNombre} ${primerApellido}`);
  }
  return Array.from(new Set(claves));
}

export function parsearFechaCongreso(fecha: string): string {
  const partes = fecha.trim().split('/');
  if (partes.length !== 3) throw new Error(`Fecha con formato inesperado: ${fecha}`);
  const [d, m, a] = partes.map(p => parseInt(p, 10));
  if (!d || !m || !a || d > 31 || m > 12 || a < 1975) {
    throw new Error(`Fecha fuera de rango: ${fecha}`);
  }
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function slugificar(apellidos: string, nombre: string): string {
  return normalizarNombre(`${apellidos}, ${nombre}`).replace(/[,\s]+/g, '-').slice(0, 90);
}
