-- =====================================================================
-- PARTE 43 — Toppings Kinder y Chocolate en los waffles
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Kinder: una barrita de chocolate con leche (12,5 g) por waffle, a
-- $788,64 cada una (precio de Agustín).
-- Chocolate: el que vino con el fondo de comercio, así que no costó nada:
-- va en $0 y 15 g por waffle. Cuando se compre, cargar el precio.
-- =====================================================================

insert into public.costos_componente_waffle
  (componente, tipo, etiqueta, unidad, costo_unitario, cantidad, siempre, cantidad_extra_si_elegido, es_estimado, fuente, nota)
values
  ('kinder', 'topping', 'Kinder (barrita 12,5 g)', 'unidad', 788.64, 1, false, 0, false,
   'Agustín: $788,64 la barrita', '1 barrita por waffle.'),
  ('chocolate', 'topping', 'Chocolate (topping)', 'g', 0, 15, false, 0, false,
   'Fondo de comercio: lo dejó el inquilino anterior',
   '15 g por waffle. Cuesta $0 hasta que se termine; cuando se compre, cargar el precio por gramo.')
on conflict (tipo, componente) do update
  set costo_unitario = excluded.costo_unitario, cantidad = excluded.cantidad, es_estimado = excluded.es_estimado,
      fuente = excluded.fuente, nota = excluded.nota, actualizado_en = now();

-- =====================================================================
-- PARA VOLVER ATRÁS: borrar las filas de tipo 'topping' con componente 'kinder' y 'chocolate'.
-- =====================================================================
