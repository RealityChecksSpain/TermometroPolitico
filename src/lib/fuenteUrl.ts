const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

export function motivoUrlInvalida(valor: unknown): string | null {
  const u = String(valor ?? '').trim();

  if (!u) return 'esta vacia';
  if (/^FUENTE_/.test(u)) return `sigue siendo el hueco "${u}"`;
  if (u.includes('...')) return `parece un hueco de ejemplo sin rellenar: "${u}"`;
  if (!/^https:\/\//i.test(u)) return 'debe empezar por https://';
  if (/\s/.test(u)) return 'lleva espacios';

  let p: URL;
  try {
    p = new URL(u);
  } catch {
    return `"${u}" no es una direccion valida`;
  }

  const host = p.hostname.toLowerCase();
  if (!host) return 'no tiene dominio';
  if (!HOST.test(host)) return `"${p.hostname}" no es un dominio valido`;
  if (!host.includes('.')) return `"${p.hostname}" no tiene dominio de primer nivel`;

  const tld = host.slice(host.lastIndexOf('.') + 1);
  if (!/^[a-z]{2,}$/.test(tld)) return `"${p.hostname}" no acaba en un dominio de primer nivel`;

  return null;
}

export function urlValida(valor: unknown): boolean {
  return motivoUrlInvalida(valor) === null;
}
