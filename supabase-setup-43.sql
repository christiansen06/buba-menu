-- =====================================================================
-- PARTE 43 — Topping Kinder en los waffles
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Una barrita de Kinder de chocolate con leche (12,5 g) por waffle. El
-- precio todavía no está: va en $0 marcado como estimado hasta que Agustín
-- pase cuánto sale la caja.
-- =====================================================================

insert into public.costos_componente_waffle
  (componente, tipo, etiqueta, unidad, costo_unitario, cantidad, siempre, cantidad_extra_si_elegido, es_estimado, fuente, nota)
values
  ('kinder', 'topping', 'Kinder (barrita 12,5 g)', 'unidad', 0, 1, false, 0, true,
   'SIN DATO',
   'FALTA el precio: 1 barrita por waffle. Mientras esté en $0 el waffle con Kinder parece más barato de lo que cuesta.')
on conflict (tipo, componente) do nothing;

-- =====================================================================
-- PARA VOLVER ATRÁS: borrar la fila con componente = 'kinder'.
-- =====================================================================
