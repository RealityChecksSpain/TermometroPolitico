export async function traerTodo<T>(
  consulta: (desde: number, hasta: number) => any,
  tam = 1000
): Promise<T[]> {
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
