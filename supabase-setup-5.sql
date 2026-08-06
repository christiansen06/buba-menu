-- =====================================================================
-- PARTE 5 — Bubble teas fríos vs calientes, y las perlas extra
--
-- ⚠️  ESTE ARCHIVO QUEDÓ VIEJO. NO CORRERLO SUELTO.
--
--     Las dos vistas de acá abajo (metrica_bubble_tea y
--     metrica_opciones_armables) las reemplaza la PARTE 6.
--
--     Correr esta parte 5 después de la 6 revierte el arreglo sin avisar:
--     las vistas vuelven a leer de pedido_items y se pierden los bubble
--     teas vendidos dentro de un combo (con ellos, el Taro pasa de cuarto
--     a segundo en el ranking).
--
--     Si instalás todo de cero, corré las partes en orden y terminá con
--     la 6. Si vas a modificar estas vistas, partí de la 6.
--
-- Correr esto en el editor SQL de Supabase, como las partes anteriores.
-- Sólo agrega vistas de lectura: no toca ninguna tabla ni ningún dato.
--
-- POR QUÉ HACE FALTA
--
-- El bubble tea frío y el caliente son el MISMO producto_id ('brown-sugar'),
-- se diferencian por detalle->>'presentacion'. Las vistas que ya existían
-- agrupan por producto_id, así que los sumaban juntos: se guardaba el dato
-- pero no había forma de contestar "¿cuántos calientes vendí?".
--
-- Lo mismo pasaba con las perlas extra: se guardan en detalle->'extras'
-- desde que se agregó el adicional, pero ninguna vista las leía.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Bubble tea: frío vs caliente, sabor por sabor.
--
-- Con esto se decide lo importante: si el caliente se vende o no, y en
-- qué sabores. Los pedidos viejos (anteriores a esta función) no tienen
-- presentacion guardada: caen en 'frio', que es lo que efectivamente eran.
-- ---------------------------------------------------------------------
create or replace view public.metrica_bubble_tea
with (security_invoker = on) as
-- Los coalesce de afuera son a propósito: un "sum ... filter" sin filas que
-- cumplan devuelve NULL, no 0. Sin esto la columna "calientes" aparecería
-- vacía hasta el primer pedido caliente y parecería que la vista no anda.
select
  producto_id,
  min(nombre)                                                              as nombre,
  sum(cantidad)                                                            as unidades,
  coalesce(sum(cantidad) filter (where coalesce(detalle->>'presentacion', 'frio') = 'frio'), 0)  as frios,
  coalesce(sum(cantidad) filter (where detalle->>'presentacion' = 'caliente'), 0)                as calientes,
  sum(cantidad * coalesce(precio_unitario, 0))                             as facturado,
  coalesce(sum(cantidad * coalesce(precio_unitario, 0))
    filter (where detalle->>'presentacion' = 'caliente'), 0)               as facturado_calientes,
  count(distinct pedido_id)                                                as pedidos
from public.pedido_items
where categoria_id = 'bubble-tea'
group by producto_id
order by unidades desc;


-- ---------------------------------------------------------------------
-- 2. Se recrea metrica_opciones_armables con dos ramas nuevas al final:
--    la presentación del bubble tea y los extras (perlas).
--
-- Mismas columnas y mismo orden que la versión de la parte 4, así que el
-- "create or replace" entra sin romper nada. Todo lo anterior queda igual.
-- ---------------------------------------------------------------------
create or replace view public.metrica_opciones_armables
with (security_invoker = on) as
select * from (

  -- WAFFLES
  select 'waffles'::text as categoria, 'topping'::text as campo,
         t::text as opcion, sum(i.cantidad) as veces
  from public.pedido_items i
  cross join lateral jsonb_array_elements_text(i.detalle->'toppings') as t
  where i.categoria_id = 'waffles' and jsonb_typeof(i.detalle->'toppings') = 'array'
  group by t

  union all
  select 'waffles', 'salsa', s::text, sum(i.cantidad)
  from public.pedido_items i
  cross join lateral jsonb_array_elements_text(i.detalle->'salsas') as s
  where i.categoria_id = 'waffles' and jsonb_typeof(i.detalle->'salsas') = 'array'
  group by s

  -- En el relleno, si es helado interesa el SABOR, no la palabra "helado".
  union all
  select 'waffles', 'relleno', coalesce(r->>'flavor', r->>'type'), sum(i.cantidad)
  from public.pedido_items i
  cross join lateral jsonb_array_elements(i.detalle->'rellenos') as r
  where i.categoria_id = 'waffles' and jsonb_typeof(i.detalle->'rellenos') = 'array'
  group by coalesce(r->>'flavor', r->>'type')

  -- HELADOS
  union all
  select 'helados', 'sabor', f::text, sum(i.cantidad)
  from public.pedido_items i
  cross join lateral jsonb_array_elements_text(i.detalle->'flavorIds') as f
  where i.categoria_id = 'helados' and jsonb_typeof(i.detalle->'flavorIds') = 'array'
  group by f

  union all
  select 'helados', 'salsa', s::text, sum(i.cantidad)
  from public.pedido_items i
  cross join lateral jsonb_array_elements_text(i.detalle->'sauceIds') as s
  where i.categoria_id = 'helados' and jsonb_typeof(i.detalle->'sauceIds') = 'array'
  group by s

  -- LICUADOS
  union all
  select 'licuados', 'fruta', f::text, sum(i.cantidad)
  from public.pedido_items i
  cross join lateral jsonb_array_elements_text(i.detalle->'fruitIds') as f
  where i.categoria_id = 'licuados' and jsonb_typeof(i.detalle->'fruitIds') = 'array'
  group by f

  union all
  select 'licuados', 'base', i.detalle->>'baseId', sum(i.cantidad)
  from public.pedido_items i
  where i.categoria_id = 'licuados' and i.detalle->>'baseId' is not null
  group by i.detalle->>'baseId'

  -- NUEVO — BUBBLE TEA: frío o caliente.
  union all
  select 'bubble-tea', 'presentacion',
         coalesce(i.detalle->>'presentacion', 'frio'), sum(i.cantidad)
  from public.pedido_items i
  where i.categoria_id = 'bubble-tea'
  group by coalesce(i.detalle->>'presentacion', 'frio')

  -- NUEVO — ADICIONALES: las perlas extra (y lo que se sume después).
  -- Sirve para saber si conviene mantener el precio del adicional.
  union all
  select i.categoria_id, 'extra', e::text, sum(i.cantidad)
  from public.pedido_items i
  cross join lateral jsonb_array_elements_text(i.detalle->'extras') as e
  where jsonb_typeof(i.detalle->'extras') = 'array'
  group by i.categoria_id, e

) x
order by categoria, campo, veces desc;
