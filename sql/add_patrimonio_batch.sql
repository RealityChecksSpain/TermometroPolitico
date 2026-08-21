-- Columnas para el batch automático de bienes (Gemini + PDF).
-- Ejecutar en SQL Editor de Supabase si aún no existen.

alter table bienes_declarados
  add column if not exists patrimonio_euros numeric,
  add column if not exists n_inmuebles integer,
  add column if not exists n_coches integer,
  add column if not exists n_motos integer,
  add column if not exists n_embarcaciones integer,
  add column if not exists n_aeronaves integer,
  add column if not exists confianza text,
  add column if not exists dudas text;

comment on column bienes_declarados.patrimonio_euros is
  'Estimación: depósitos + valores + planes − deuda pendiente. Los inmuebles no tienen valoración en el PDF.';
comment on column bienes_declarados.n_inmuebles is
  'Suma de filas de inmuebles urbanos + rústicos declarados.';
comment on column bienes_declarados.n_coches is
  'Vehículos tipo coche/turismo/todoterreno clasificados del detalle del PDF.';
comment on column bienes_declarados.n_motos is
  'Motocicletas / scooters clasificados del detalle del PDF.';
