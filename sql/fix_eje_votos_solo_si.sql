-- Corrige el eje de votos del mapa.
-- Problema: contar rechazos (o invertir mal el signo) sitúa al PP a la izquierda
-- y al PSOE a la derecha. La oposición vota "no" a normas del Gobierno sin que
-- eso implique una posición económica de izquierda.
--
-- Regla nueva: SOLO votos a favor (voto_mayoritario = 'si').
-- Signo: aumenta gasto/impuestos/regulación = izquierda (-1);
--        reduce = derecha (+1). Neutro se ignora.
-- Social: aumenta derechos/migración = progresista (-1);
--         reduce = conservador (+1).
-- Posición relativa: media del partido menos media del conjunto.
--
-- Pegar en SQL Editor de Supabase y luego: select * from v_mapa_partidos order by voto_economico;

create or replace view mv_eje_votos_base as
with votos_si as (
  select vp.partido_id, vp.votacion_id
  from mv_voto_partido vp
  where vp.voto_mayoritario = 'si'
),
codigos as (
  select
    vs.partido_id,
    ic.gasto_publico,
    ic.impuestos,
    ic.regulacion_mercado,
    ic.derechos_individuales,
    ic.apertura_migratoria
  from votos_si vs
  join votacion_iniciativa vi on vi.votacion_id = vs.votacion_id
  join iniciativa_codigo ic on ic.iniciativa_id = vi.iniciativa_id
),
signos as (
  select
    partido_id,
    case gasto_publico when 'aumenta' then -1 when 'reduce' then 1 end as s_gasto,
    case impuestos when 'aumenta' then -1 when 'reduce' then 1 end as s_imp,
    case regulacion_mercado when 'aumenta' then -1 when 'reduce' then 1 end as s_reg,
    case derechos_individuales when 'aumenta' then -1 when 'reduce' then 1 end as s_der,
    case apertura_migratoria when 'aumenta' then -1 when 'reduce' then 1 end as s_mig
  from codigos
),
agg as (
  select
    partido_id,
    count(*) filter (where s_gasto is not null) as n_gasto,
    count(*) filter (where s_imp is not null) as n_impuestos,
    count(*) filter (where s_reg is not null) as n_regulacion,
    avg(s_gasto) filter (where s_gasto is not null) as ratio_gasto,
    avg(s_imp) filter (where s_imp is not null) as ratio_impuestos,
    avg(s_reg) filter (where s_reg is not null) as ratio_regulacion,
    avg(s_der) filter (where s_der is not null) as ratio_derechos,
    avg(s_mig) filter (where s_mig is not null) as ratio_migracion,
    count(*) as leyes_apoyadas
  from signos
  group by partido_id
),
eco as (
  select
    partido_id,
    n_gasto, n_impuestos, n_regulacion,
    ratio_gasto, ratio_impuestos, ratio_regulacion,
    ratio_derechos, ratio_migracion,
    leyes_apoyadas,
    -- bruto: media de las tres dimensiones económicas disponibles
    (
      coalesce(ratio_gasto, 0) * (case when n_gasto > 0 then 1 else 0 end)
      + coalesce(ratio_impuestos, 0) * (case when n_impuestos > 0 then 1 else 0 end)
      + coalesce(ratio_regulacion, 0) * (case when n_regulacion > 0 then 1 else 0 end)
    ) / nullif(
      (case when n_gasto > 0 then 1 else 0 end)
      + (case when n_impuestos > 0 then 1 else 0 end)
      + (case when n_regulacion > 0 then 1 else 0 end)
    , 0) as bruto_economico,
    (
      coalesce(ratio_derechos, 0) * (case when ratio_derechos is not null then 1 else 0 end)
      + coalesce(ratio_migracion, 0) * (case when ratio_migracion is not null then 1 else 0 end)
    ) / nullif(
      (case when ratio_derechos is not null then 1 else 0 end)
      + (case when ratio_migracion is not null then 1 else 0 end)
    , 0) as bruto_social
  from agg
),
medias as (
  select avg(bruto_economico) as m_eco, avg(bruto_social) as m_soc from eco
)
select
  p.slug as partido,
  p.siglas,
  -- partidos no guarda color en BD; se mapea aquí (misma paleta que src/lib/partidos.ts)
  case lower(p.slug)
    when 'psoe' then '#C8102E'
    when 'pp' then '#0B4DA2'
    when 'vox' then '#5BC236'
    when 'sumar' then '#B5227A'
    when 'podemos' then '#6A2E7C'
    when 'erc' then '#F2A81C'
    when 'junts' then '#6FD3E8'
    when 'bildu' then '#8A9B0F'
    when 'eh-bildu' then '#8A9B0F'
    when 'pnv' then '#00693C'
    when 'bng' then '#1B9AD6'
    when 'cc' then '#E8D019'
    when 'upn' then '#8E9299'
    when 'compromis' then '#F27A1A'
    when 'compromís' then '#F27A1A'
    when 'masmadrid' then '#00A99D'
    when 'ciudadanos' then '#EB6109'
    when 'mixto' then '#9AA0A6'
    else '#8E9299'
  end as color,
  e.leyes_apoyadas,
  e.leyes_apoyadas as leyes_valoradas,
  coalesce(e.n_gasto, 0) + coalesce(e.n_impuestos, 0) + coalesce(e.n_regulacion, 0) as base_economico,
  (case when e.ratio_derechos is not null then 1 else 0 end)
    + (case when e.ratio_migracion is not null then 1 else 0 end) as base_social,
  e.n_gasto,
  e.n_impuestos,
  e.n_regulacion,
  round(e.ratio_gasto::numeric, 3) as ratio_gasto,
  round(e.ratio_impuestos::numeric, 3) as ratio_impuestos,
  round(e.ratio_regulacion::numeric, 3) as ratio_regulacion,
  round((e.bruto_economico - m.m_eco)::numeric, 3) as eje_economico,
  round((e.bruto_social - m.m_soc)::numeric, 3) as eje_social,
  round(e.bruto_economico::numeric, 3) as bruto_economico
from eco e
join partidos p on p.id = e.partido_id
cross join medias m;

-- Si mv_eje_votos es una vista materializada, sustituye su definición para que
-- lea de esta base, o recrea mv_eje_votos como:
--   drop materialized view if exists mv_eje_votos cascade;
--   create materialized view mv_eje_votos as select * from mv_eje_votos_base;
--   refresh materialized view mv_eje_votos;
-- Y actualiza v_mapa_partidos / refrescar_metricas en consecuencia.

comment on view mv_eje_votos_base is
  'Eje de votos solo con sí. aumenta=-1 (izq/prog), reduce=+1 (der/cons). Relativo a la media.';
