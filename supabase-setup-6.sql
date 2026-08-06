-- =====================================================================
-- PARTE 6 — Los bubble teas de las promos también cuentan
--
-- Correr en el editor SQL de Supabase. Sólo reemplaza vistas de lectura:
-- no toca ninguna tabla ni ningún dato. Se puede correr más de una vez.
--
-- QUÉ ESTABA MAL
--
-- metrica_bubble_tea (parte 5) lee de pedido_items filtrando por
-- categoria_id = 'bubble-tea'. Pero un bubble tea vendido dentro de un
-- combo NO se guarda así: la línea queda con categoria_id = 'promociones'
-- y el bubble tea aparece adentro de detalle->componentes.
--
-- Hay dos promos que venden bubble teas, con los 7 sabores cada una:
--   · Bubble Tea + Waffle
--   · Bubble Tea + Postre
--
-- O sea que todo lo que salga por ahí quedaba afuera del conteo. Es el
-- mismo error que corregimos en la parte 4 con el ranking general, que
-- por eso hoy lee de ventas_desglosadas. La vista nueva volvió a la
-- tabla cruda y se llevó el problema puesto.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ventas_desglosadas gana dos columnas al final
-- ---------------------------------------------------------------------
-- Para poder separar frío de caliente hace falta la presentación, y para
-- la facturación hace falta el precio. Ninguna de las dos estaba.
--
-- Van AL FINAL a propósito: "create or replace view" puede agregar
-- columnas nuevas al final, pero no puede cambiar ni reordenar las que
-- ya están. Si las metiera en el medio, fallaría igual que la parte 4.
--
-- Sobre los componentes de un combo:
--   · presentacion queda en NULL. Las promos no ofrecen la versión
--     caliente, así que abajo se los cuenta como fríos, igual que a los
--     pedidos viejos que tampoco la tenían guardada.
--   · precio_unitario queda en NULL a propósito. Un bubble tea adentro
--     de un combo no tiene precio propio: se cobró el combo entero.
--     Inventarle uno ensuciaría la facturación.
create or replace view public.ventas_desglosadas
with (security_invoker = on) as

-- (a) líneas que son un solo producto
select
  i.pedido_id,
  p.creado_en,
  i.categoria_id,
  i.producto_id,
  i.nombre,
  i.cantidad,
  false           as en_promo,
  null::text      as promo_id,
  i.detalle->>'presentacion' as presentacion,
  i.precio_unitario
from public.pedido_items i
join public.pedidos p on p.id = i.pedido_id
where jsonb_typeof(i.detalle->'componentes') is distinct from 'array'

union all

-- (b) líneas con desglose, abiertas en sus partes.
-- La cantidad se multiplica: 2 combos que llevan 1 café cada uno = 2 cafés.
select
  i.pedido_id,
  p.creado_en,
  comp->>'cat'      as categoria_id,
  comp->>'producto' as producto_id,
  comp->>'nombre'   as nombre,
  i.cantidad * coalesce((comp->>'cantidad')::integer, 1) as cantidad,
  (i.categoria_id = 'promociones')                       as en_promo,
  case when i.categoria_id = 'promociones' then i.producto_id end as promo_id,
  null::text    as presentacion,
  null::integer as precio_unitario
from public.pedido_items i
join public.pedidos p on p.id = i.pedido_id
cross join lateral jsonb_array_elements(i.detalle->'componentes') as comp
where jsonb_typeof(i.detalle->'componentes') = 'array';


-- ---------------------------------------------------------------------
-- 2. metrica_bubble_tea ahora cuenta todo
-- ---------------------------------------------------------------------
-- Las 8 columnas de la parte 5 quedan igual y en el mismo orden, para que
-- el "create or replace" entre sin quejarse. La novena es nueva:
--
--   en_promo → cuántos de esos bubble teas salieron dentro de un combo.
--
-- Esa columna es la que te dice si el sabor se vende solo o si vive de la
-- promo. Un sabor con 40 unidades donde 35 son en_promo no es un éxito
-- del sabor: es un éxito del combo. Si sacás el combo, se cae.
--
-- Ojo con "facturado": cuenta sólo lo vendido suelto, porque lo que salió
-- en combo se facturó como combo. Para esa plata, mirá metrica_promos.
create or replace view public.metrica_bubble_tea
with (security_invoker = on) as
select
  producto_id,
  min(nombre)                                as nombre,
  sum(cantidad)                              as unidades,
  -- Sin presentación guardada = frío: así eran los pedidos viejos, y así
  -- son los que salen en combo (la promo no ofrece la versión caliente).
  coalesce(sum(cantidad) filter (where coalesce(presentacion, 'frio') = 'frio'), 0) as frios,
  coalesce(sum(cantidad) filter (where presentacion = 'caliente'), 0)               as calientes,
  coalesce(sum(cantidad * coalesce(precio_unitario, 0)), 0)                         as facturado,
  coalesce(sum(cantidad * coalesce(precio_unitario, 0))
    filter (where presentacion = 'caliente'), 0)                                    as facturado_calientes,
  count(distinct pedido_id)                                                         as pedidos,
  coalesce(sum(cantidad) filter (where en_promo), 0)                                as en_promo
from public.ventas_desglosadas
where categoria_id = 'bubble-tea'
group by producto_id
order by unidades desc;


-- ---------------------------------------------------------------------
-- 3. La rama "presentacion" de metrica_opciones_armables, igual
-- ---------------------------------------------------------------------
-- Misma corrección: pasa de pedido_items a ventas_desglosadas para que
-- los combos entren en la cuenta. Las otras ramas quedan intactas y las
-- columnas son las mismas de siempre.
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

  -- BUBBLE TEA: frío o caliente. Ahora desde ventas_desglosadas, así los
  -- que salieron en combo también suman (antes se perdían).
  union all
  select 'bubble-tea', 'presentacion',
         coalesce(v.presentacion, 'frio'), sum(v.cantidad)
  from public.ventas_desglosadas v
  where v.categoria_id = 'bubble-tea'
  group by coalesce(v.presentacion, 'frio')

  -- ADICIONALES: las perlas extra (y lo que se sume después).
  -- Sigue leyendo de pedido_items porque los combos no ofrecen adicionales.
  union all
  select i.categoria_id, 'extra', e::text, sum(i.cantidad)
  from public.pedido_items i
  cross join lateral jsonb_array_elements_text(i.detalle->'extras') as e
  where jsonb_typeof(i.detalle->'extras') = 'array'
  group by i.categoria_id, e

) x
order by categoria, campo, veces desc;
