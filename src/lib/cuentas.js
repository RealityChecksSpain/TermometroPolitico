import { supabase } from './cliente.js';

export const ETIQUETAS = {
  ingresos_publicos_ordinarios: 'ingresos públicos ordinarios',
  subvenciones_funcionamiento: 'subvenciones de funcionamiento',
  aportaciones_grupos_institucionales: 'aportaciones de grupos institucionales',
  ingresos_privados: 'ingresos privados',
  cuotas_afiliados: 'cuotas de afiliados',
  aportaciones_cargos_publicos: 'aportaciones de cargos públicos',
  donaciones_y_legados: 'donaciones y legados',
  ingresos_electorales_publicos: 'ingresos electorales públicos',
  gastos_personal: 'gastos de personal',
  gastos_ordinarios: 'gastos ordinarios',
  gastos_electorales: 'gastos electorales',
  gastos_financieros: 'gastos financieros',
  resultado_ejercicio: 'resultado del ejercicio',
  deuda_entidades_credito: 'deuda con entidades de crédito',
  total_activo: 'total activo',
  patrimonio_neto: 'patrimonio neto'
};

const PUBLICOS = ['ingresos_publicos_ordinarios', 'ingresos_electorales_publicos'];
const PRIVADOS = ['ingresos_privados'];
const GASTOS = ['gastos_ordinarios', 'gastos_electorales', 'gastos_financieros'];

export function euros(v, decimales = 0) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v).toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  });
}

export function millones(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const m = Number(v) / 1e6;
  return `${m.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M€`;
}

export function resumirCuentas(data) {
  if (!data?.length) return {};

  const porPartido = {};
  for (const f of data) {
    if (!f.partido || !f.concepto) continue;
    const ej = Number(f.ejercicio);
    const p = (porPartido[f.partido] ??= {});
    const e = (p[ej] ??= { ejercicio: ej, cifras: {}, paginas: {}, fuentes: [], notas: [] });
    e.cifras[f.concepto] = Number(f.importe);
    if (f.pagina != null) e.paginas[f.concepto] = Number(f.pagina);
    if (f.nota && !e.notas.some(x => x.texto === f.nota)) {
      e.notas.push({ concepto: f.concepto, texto: f.nota });
    }
    if (f.fuente_url && !e.fuentes.some(x => x.url === f.fuente_url)) {
      e.fuentes.push({ url: f.fuente_url, titulo: f.fuente ?? null });
    }
  }

  const salida = {};
  let masReciente = 0;

  for (const [partido, ejercicios] of Object.entries(porPartido)) {
    const ultimo = Object.values(ejercicios).sort((a, b) => b.ejercicio - a.ejercicio)[0];
    const c = ultimo.cifras;

    const suma = claves => {
      const presentes = claves.filter(k => Number.isFinite(c[k]));
      return presentes.length ? presentes.reduce((t, k) => t + c[k], 0) : null;
    };

    const publico = suma(PUBLICOS);
    const privado = suma(PRIVADOS);
    const ingresos = publico != null && privado != null ? publico + privado : null;
    const gastos = Number.isFinite(c.gastos_ordinarios) ? suma(GASTOS) : null;
    const balance = Number.isFinite(c.total_activo) || Number.isFinite(c.patrimonio_neto);

    const noPublicado = [];
    if (ingresos == null) noPublicado.push('lo que ingresó');
    if (gastos == null) noPublicado.push('lo que gastó');
    if (!balance) noPublicado.push('el balance');

    if (ultimo.ejercicio > masReciente) masReciente = ultimo.ejercicio;

    salida[partido] = {
      ...ultimo,
      fuente: ultimo.fuentes[0] ?? null,
      publico,
      privado,
      ingresos,
      gastos,
      noPublicado,
      ejercicios: Object.keys(ejercicios).map(Number).sort((a, b) => b - a),
      saldo: ingresos != null && gastos != null ? ingresos - gastos : null,
      porcentajePublico:
        ingresos && publico != null && privado != null
          ? Math.round((publico / ingresos) * 100)
          : null
    };
  }

  for (const v of Object.values(salida)) {
    v.masReciente = masReciente;
    v.desfasado = masReciente > 0 && v.ejercicio < masReciente;
  }

  return salida;
}

export async function traerCuentas() {
  if (!supabase) return null;

  const { data, error } = await supabase.from('v_cuentas_partido').select('*');
  if (error) {
    console.error('cuentas', error.message);
    return null;
  }

  return resumirCuentas(data);
}