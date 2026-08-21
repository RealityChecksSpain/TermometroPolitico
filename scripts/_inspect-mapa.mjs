const u = 'https://xktbcpqnytepgbmxfney.supabase.co';
const k =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrdGJjcHFueXRlcGdibXhmbmV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg5MDE2MywiZXhwIjoyMTAyNDY2MTYzfQ.L4mDIldnI8_pFOHQ-_EdnIDbIiB6SeNjdbnFJZ7amqc';
const h = { apikey: k, Authorization: 'Bearer ' + k };

async function get(path) {
  const r = await fetch(u + path, { headers: h });
  const t = await r.text();
  console.log('\n###', path, r.status);
  console.log(t.slice(0, 8000));
  return t;
}

const openapi = await fetch(u + '/rest/v1/', { headers: h }).then((r) => r.json());
for (const name of [
  'mv_eje_votos',
  'mv_eje_programa',
  'v_mapa_partidos',
  'mv_voto_partido',
  'iniciativa_codigo'
]) {
  const s = openapi.definitions?.[name];
  console.log('\nSCHEMA', name, Object.keys(s?.properties || {}));
}

await get('/rest/v1/mv_eje_votos?select=*&order=eje_economico');
await get(
  '/rest/v1/mv_eje_programa?select=siglas,eje_economico,eje_social,ratio_gasto,n_gasto,ratio_impuestos,n_impuestos,ratio_regulacion,n_regulacion&order=eje_economico'
);

for (const path of [
  '/rest/v1/rpc/exec_sql',
  '/rest/v1/rpc/sql',
  '/rest/v1/rpc/execute_sql'
]) {
  const r = await fetch(u + path, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select 1' })
  });
  console.log(path, r.status, (await r.text()).slice(0, 300));
}
