
create or replace view v_mapa_partidos as
with escanos as (
  select
    coalesce(nullif(trim(partido_siglas), ''), nullif(trim(partido), '')) as clave,
    count(*)::int as escanos
  from mv_diputados
  where activo is distinct from false
  group by 1
),
prog as (
  select * from mv_eje_programa
),
vot as (
  select * from mv_eje_votos
)
select
  coalesce(p.partido, v.partido) as partido,
  coalesce(p.siglas, v.siglas) as siglas,
  coalesce(p.color, v.color, '#8E9299') as color,
  coalesce(e.escanos, 0) as escanos,
  p.eje_economico as prog_economico,
  p.eje_social as prog_social,
  p.bruto_economico as prog_bruto_economico,
  p.promesas as promesas_codificadas,
  v.eje_economico as voto_economico,
  v.eje_social as voto_social,
  v.bruto_economico as voto_bruto_economico,
  v.leyes_valoradas,
  v.leyes_apoyadas
from prog p
full outer join vot v on v.partido = p.partido
left join escanos e
  on e.clave = coalesce(p.siglas, v.siglas)
  or lower(e.clave) = lower(coalesce(p.partido, v.partido));

comment on view v_mapa_partidos is
  'Mapa 2D: programa (prog_*) + votos (voto_*). Fuente: mv_eje_programa + mv_eje_votos.';

-- Recarga el cache de PostgREST (si tu proyecto lo necesita):
-- notify pgrst, 'reload schema';
