-- =====================================================================
-- BüBa — Parte 4: correcciones encontradas mirando el primer pedido real
-- Pegar en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LA HORA (spoiler: no estaba mal)
-- ---------------------------------------------------------------------
-- La columna creado_en es "timestamptz": guarda el instante en horario
-- universal y se acuerda de que es universal (por eso termina en +00).
-- Tu pedido dice 03:43:33+00, que son las 00:43:33 de Mar del Plata.
-- El dato está bien; lo que pasa es que el panel de Supabase lo muestra
-- en hora universal.
--
-- NO hay que "arreglar" la columna. Guardar hora local sería un error
-- clásico y caro: en el cambio de hora tendrías pedidos duplicados o
-- faltantes, y todo cálculo de "cuánto pasó entre A y B" saldría mal.
-- Lo correcto es guardar universal y mostrar local. Esta vista hace eso.
create or replace view public.pedidos_local
with (security_invoker = on) as
select
  id,
  (creado_en at time zone 'America/Argentina/Buenos_Aires')::timestamp(0) as fecha_hora,
  to_char(creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
  total,
  cantidad_items,
  creado_en as guardado_utc
from public.pedidos
order by creado_en desc;

-- Para mirar los pedidos como los leerías vos:
--    select * from pedidos_local;


-- ---------------------------------------------------------------------
-- 2. EL RANKING SE ESTABA PARTIENDO EN PEDAZOS  (esto sí era un error)
-- ---------------------------------------------------------------------
-- Al mirar tu primer pedido apareció el problema: los dos waffles que el
-- cliente armó a mano salieron como DOS filas distintas del ranking, no
-- como dos unidades del mismo producto. ¿Por qué? Porque agrupábamos por
-- "nombre", y el nombre de un armable trae toda la configuración adentro:
--
--   "Waffle Mixto · Nutella · Banana · Pistacho"
--   "Waffle Simple · Helado Dulce de Leche · Oreo · Dulce de Leche"
--
-- Son el mismo producto (waffle armado) con distinto relleno. Agrupados
-- por nombre, cada waffle armado del mundo sería su propia fila y el
-- ranking quedaría inservible justo en la categoría más vendida.
--
-- La identidad de un producto es categoria_id + producto_id. El nombre es
-- decoración. Estas versiones agrupan por lo que corresponde.
--
-- Nota para el futuro: la columna sigue llamándose "nombre" aunque ahora
-- sea un ejemplo y no el nombre exacto. Es a propósito. "create or replace
-- view" puede cambiar lo que la vista calcula, pero NO puede renombrar sus
-- columnas: para eso habría que borrar la vista y volver a crearla, y si
-- otra vista depende de ella se rompe la cadena. No vale la pena romper
-- nada por un nombre de columna.

create or replace view public.metrica_productos
with (security_invoker = on) as
select
  categoria_id,
  producto_id,
  min(nombre)                                  as nombre,
  sum(cantidad)                                as unidades,
  count(distinct pedido_id)                    as pedidos,
  sum(cantidad * coalesce(precio_unitario, 0)) as facturado
from public.pedido_items
group by categoria_id, producto_id
order by unidades desc;

create or replace view public.metrica_productos_real
with (security_invoker = on) as
select
  categoria_id,
  producto_id,
  min(nombre)                               as nombre,
  sum(cantidad)                             as unidades,
  sum(cantidad) filter (where en_promo)     as dentro_de_promo,
  sum(cantidad) filter (where not en_promo) as vendido_suelto,
  count(distinct pedido_id)                 as pedidos
from public.ventas_desglosadas
group by categoria_id, producto_id
order by unidades desc;

-- Mismo arreglo en las duplas: si no, "café + waffle armado" se partiría
-- en una dupla distinta por cada combinación de relleno.
create or replace view public.duplas_frecuentes
with (security_invoker = on) as
select
  a.categoria_id  as cat_a,
  a.producto_id   as prod_a,
  min(a.nombre)   as nombre_a,
  b.categoria_id  as cat_b,
  b.producto_id   as prod_b,
  min(b.nombre)   as nombre_b,
  count(distinct a.pedido_id) as veces_juntos
from public.ventas_desglosadas a
join public.ventas_desglosadas b
  on a.pedido_id = b.pedido_id
 and (a.categoria_id, coalesce(a.producto_id, '')) < (b.categoria_id, coalesce(b.producto_id, ''))
group by a.categoria_id, a.producto_id, b.categoria_id, b.producto_id
having count(distinct a.pedido_id) >= 2
order by veces_juntos desc;

create or replace view public.trios_frecuentes
with (security_invoker = on) as
select
  min(a.nombre) as nombre_a,
  min(b.nombre) as nombre_b,
  min(c.nombre) as nombre_c,
  count(distinct a.pedido_id) as veces_juntos
from public.ventas_desglosadas a
join public.ventas_desglosadas b
  on a.pedido_id = b.pedido_id
 and (a.categoria_id, coalesce(a.producto_id, '')) < (b.categoria_id, coalesce(b.producto_id, ''))
join public.ventas_desglosadas c
  on a.pedido_id = c.pedido_id
 and (b.categoria_id, coalesce(b.producto_id, '')) < (c.categoria_id, coalesce(c.producto_id, ''))
group by
  a.categoria_id, a.producto_id,
  b.categoria_id, b.producto_id,
  c.categoria_id, c.producto_id
having count(distinct a.pedido_id) >= 3
order by veces_juntos desc;

create or replace view public.top_productos_30d
with (security_invoker = on) as
select
  categoria_id,
  producto_id,
  min(nombre)   as nombre,
  sum(cantidad) as unidades
from public.ventas_desglosadas
where creado_en >= now() - interval '30 days'
group by categoria_id, producto_id
order by unidades desc;


-- ---------------------------------------------------------------------
-- 3. QUÉ ELIGE LA GENTE CUANDO ARMA SU PROPIO PRODUCTO
-- ---------------------------------------------------------------------
-- Esto faltaba y es donde está la información más útil que tenés.
--
-- Cuando alguien arma un waffle, el ranking sólo dice "waffle armado".
-- Pero adentro de detalle quedó guardado QUÉ le puso. Esta vista lo abre
-- y por fin contesta preguntas como "¿cuántas veces alguien eligió el
-- topping pepito?" o "¿la salsa de pistacho la pide alguien?".
--
-- Sirve para decidir qué dejar de comprar: si un insumo aparece 3 veces
-- en tres meses, te está ocupando lugar en la heladera.
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

) x
order by categoria, campo, veces desc;
