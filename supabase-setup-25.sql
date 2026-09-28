-- =====================================================================
-- PARTE 25 — Categoría "Eventos" y las respuestas del 29/09
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- · "Evento Base Naval" ($1.000.000): lo que se pagó para participar con
--   el food truck. Va a una categoría propia, del negocio (grupo
--   'operativo'): así se compara con lo que vende el truck en el evento.
--   Si fuera 'inversion' quedaría fuera de la ganancia mientras las ventas
--   del evento sí entran, y el evento parecería más rentable de lo que es.
-- · Happy City: proveedor (mercadería).
-- · Sube: la tarjeta del colectivo para ir y volver al local (transporte).
-- =====================================================================

insert into public.fin_categorias (id, tipo, nombre, grupo, orden)
values ('eventos', 'egreso', 'Eventos (participación)', 'operativo', 85)
on conflict (id) do nothing;

update public.fin_movimientos
   set categoria_id = 'eventos', revisar = false, contraparte = 'Base Naval',
       notas = 'Participación del food truck en el evento', actualizado_en = now()
 where descripcion ilike 'evento base naval%';

update public.fin_movimientos set revisar = false, contraparte = 'Happy City', actualizado_en = now()
 where descripcion ilike 'happy city%';

update public.fin_movimientos set revisar = false, contraparte = 'SUBE', actualizado_en = now()
 where descripcion ~* '^sube' and categoria_id = 'transporte';

-- Reversa:
-- update public.fin_movimientos set categoria_id = 'mercaderia', revisar = true where categoria_id = 'eventos';
-- delete from public.fin_categorias where id = 'eventos';
