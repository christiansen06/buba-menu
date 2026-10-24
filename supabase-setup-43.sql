-- =====================================================================
-- PARTE 43 — Toppings Kinder y Chocolate en los waffles
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Kinder: una barrita de chocolate con leche (12,5 g) por waffle, a
-- $788,64 cada una (precio de Agustín).
-- Chocolate: el que quedó del dueño anterior. Sin precio ni gramaje todavía:
-- va en $0 marcado como estimado.
-- =====================================================================

insert into public.costos_componente_waffle
  (componente, tipo, etiqueta, unidad, costo_unitario, cantidad, siempre, cantidad_extra_si_elegido, es_estimado, fuente, nota)
values
  ('kinder', 'topping', 'Kinder (barrita 12,5 g)', 'unidad', 788.64, 1, false, 0, false,
   'Agustín: $788,64 la barrita', '1 barrita por waffle.'),
  ('chocolate', 'topping', 'Chocolate (topping)', 'g', 0, 20, false, 0, true,
   'SIN DATO',
   'FALTA el precio por kilo y el gramaje (20 g asumido). Es el que quedó del dueño anterior: '
   'mientras esté en $0 el waffle con este topping parece más barato de lo que cuesta.')
on conflict (tipo, componente) do update
  set costo_unitario = excluded.costo_unitario, cantidad = excluded.cantidad, es_estimado = excluded.es_estimado,
      fuente = excluded.fuente, nota = excluded.nota, actualizado_en = now();

-- =====================================================================
-- PARA VOLVER ATRÁS: borrar las filas de tipo 'topping' con componente 'kinder' y 'chocolate'.
-- =====================================================================
