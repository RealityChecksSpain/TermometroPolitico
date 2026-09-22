const PUBLICOS = new Set([
  'ingresos_publicos_ordinarios',
  'subvenciones_funcionamiento',
  'aportaciones_grupos_institucionales',
  'ingresos_electorales_publicos'
]);

const PRIVADOS = new Set([
  'ingresos_privados',
  'cuotas_afiliados',
  'aportaciones_cargos_publicos',
  'donaciones_y_legados'
]);

const GASTOS = new Set(['gastos_personal', 'gastos_ordinarios', 'gastos_electorales', 'gastos_financieros']);

const BALANCE = new Set(['total_activo', 'patrimonio_neto']);

export function claseDocumento(conceptos: Iterable<string>): string {
  const vistos = new Set(conceptos);
  const hay = (s: Set<string>) => [...vistos].some(c => s.has(c));
  const publicos = hay(PUBLICOS);
  const privados = hay(PRIVADOS);
  const gastos = hay(GASTOS);
  const balance = hay(BALANCE);

  if (balance && (publicos || privados || gastos)) return 'Cuentas anuales';
  if (balance) return 'Balance de situación';
  if ((publicos || privados) && gastos) return 'Cuenta de resultados';
  if (publicos && !privados) return 'Relación de ingresos públicos';
  if (privados && !publicos) return 'Relación de ingresos privados';
  if (publicos || privados) return 'Relación de ingresos';
  if (vistos.has('deuda_entidades_credito')) return 'Detalle de deuda';
  return 'Cuentas anuales';
}

export function anfitrion(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function tituloDocumento(
  conceptos: Iterable<string>,
  siglas: string,
  desde: number,
  variosPartidos = false,
  hasta = desde
): string {
  const a = Math.min(desde, hasta);
  const b = Math.max(desde, hasta);
  const periodo = b > a ? `${a}-${b}` : `${a}`;
  if (variosPartidos) return `Informe de fiscalización, ejercicio ${periodo}`;
  return `${claseDocumento(conceptos)} ${siglas} ${periodo}`;
}
