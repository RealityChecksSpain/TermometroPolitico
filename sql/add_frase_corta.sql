-- Frase corta para listados (tag + una frase + título legal abajo).
-- Pegar en SQL Editor de Supabase.

alter table resumenes_ia
  add column if not exists frase_corta text;

comment on column resumenes_ia.frase_corta is
  'Una frase llana (max ~18 palabras) para listados. Sin valorar ni nombrar al autor.';

-- Tras esto, regenera resúmenes con: npm run resumir
-- (VERSION_PROMPT=v3-frase-corta-2026-08) y refresca mv_normas.
